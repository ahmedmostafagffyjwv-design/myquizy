import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-2.5-flash";

function getGateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  return createLovableAiGatewayProvider(key);
}

// ---------- OCR an uploaded image (base64) ----------
const OcrInput = z.object({
  imageBase64: z.string().min(10), // data URL or raw base64
  mimeType: z.string().default("image/jpeg"),
});

export const ocrImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OcrInput.parse(d))
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const dataUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:${data.mimeType};base64,${data.imageBase64}`;

    const { text } = await generateText({
      model: gateway(MODEL),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "استخرج كل النص العربي والإنجليزي من هذه الصورة كما هو، بدون أي إضافة. أرجع النص الخام فقط.",
            },
            { type: "image", image: dataUrl } as any,
          ] as any,
        },
      ],
    });
    return { text };
  });

// ---------- Generate exam questions ----------
const QUESTION_SHAPES = [
  "memorization",
  "understanding",
  "problems",
  "visual",
  "comparison",
  "mixed",
] as const;

const GenInput = z.object({
  sourceId: z.string().uuid(),
  title: z.string().min(1).max(200),
  durationMinutes: z.number().int().min(1).max(300),
  questionCount: z.number().int().min(1).max(30),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
  questionType: z.enum(["mcq", "essay", "mixed"]),
  questionShape: z.enum(QUESTION_SHAPES).default("mixed"),
  isRetraining: z.boolean().default(false),
  weakQuestionIds: z.array(z.string().uuid()).optional(),
});

const ManualQuestionAssistInput = z.object({
  questionText: z.string().min(8).max(4000),
  mode: z.enum(["choices", "similar"]),
  questionType: z.enum(["mcq", "essay", "mixed"]).default("mcq"),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
});

const questionSchema = z.object({
  type: z.enum(["mcq", "essay"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question_text: z.string(),
  options: z.array(z.string()).optional().describe("For MCQ: 4 options. For essay: omit."),
  correct_answer: z.string().describe("For MCQ: the exact correct option text. For essay: a model answer."),
  explanation: z.string(),
  source_excerpt: z.string().describe("The exact passage from the source that this question is based on."),
});

const examSchema = z.object({
  questions: z.array(questionSchema),
});

const typeMap: Record<string, "mcq" | "essay"> = {
  mcq: "mcq",
  multiple_choice: "mcq",
  "multiple choice": "mcq",
  "اختيار من متعدد": "mcq",
  "اختيار متعدد": "mcq",
  essay: "essay",
  "مقال": "essay",
  "مقالي": "essay",
  "مقالية": "essay",
};

const difficultyMap: Record<string, "easy" | "medium" | "hard"> = {
  easy: "easy",
  "سهل": "easy",
  "سهلة": "easy",
  medium: "medium",
  "متوسط": "medium",
  "متوسطة": "medium",
  hard: "hard",
  "صعب": "hard",
  "صعبة": "hard",
};

function extractJsonValue(raw: string) {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if ((char === "{" || char === "[") && start === -1) {
      start = i;
      depth = 1;
      continue;
    }

    if (start === -1) continue;

    if (char === "{" || char === "[") depth += 1;
    if (char === "}" || char === "]") depth -= 1;

    if (start !== -1 && depth === 0) {
      return JSON.parse(cleaned.slice(start, i + 1));
    }
  }

  throw new Error("NO_JSON_FOUND");
}

function normalizeOptions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|•|-|(?:^|\s)[A-Dأبجده]\s*[\).:-]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeCorrectAnswer(value: unknown, options: string[]) {
  const answer = String(value ?? "").trim();
  const answerIndexMap: Record<string, number> = {
    A: 0,
    B: 1,
    C: 2,
    D: 3,
    "1": 0,
    "2": 1,
    "3": 2,
    "4": 3,
    "أ": 0,
    "ب": 1,
    "ج": 2,
    "د": 3,
  };

  const mappedIndex = answerIndexMap[answer.toUpperCase()] ?? answerIndexMap[answer];
  if (mappedIndex !== undefined && options[mappedIndex]) return options[mappedIndex];
  return answer;
}

function normalizeExamPayload(payload: unknown) {
  type NormalizedQuestion = {
    type?: "mcq" | "essay";
    difficulty?: "easy" | "medium" | "hard";
    question_text: string;
    options: string[];
    correct_answer: string;
    explanation: string;
    source_excerpt: string;
  };

  const rawQuestions = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as any)?.questions)
      ? (payload as any).questions
      : Array.isArray((payload as any)?.items)
        ? (payload as any).items
        : Array.isArray((payload as any)?.exam?.questions)
          ? (payload as any).exam.questions
          : [];

  const questions = rawQuestions
    .map((question: any): NormalizedQuestion => {
      const options = normalizeOptions((question as any)?.options);
      const typeKey = String((question as any)?.type ?? (question as any)?.question_type ?? "").trim().toLowerCase();
      const difficultyKey = String((question as any)?.difficulty ?? (question as any)?.level ?? "").trim().toLowerCase();
      const type = typeMap[typeKey];
      const difficulty = difficultyMap[difficultyKey];
      const correctAnswer = normalizeCorrectAnswer(
        (question as any)?.correct_answer ?? (question as any)?.correctAnswer ?? (question as any)?.answer,
        options,
      );

      return {
        type,
        difficulty,
        question_text: String((question as any)?.question_text ?? (question as any)?.questionText ?? (question as any)?.question ?? "").trim(),
        options: type === "essay" ? [] : options,
        correct_answer: correctAnswer,
        explanation: String((question as any)?.explanation ?? (question as any)?.reasoning ?? (question as any)?.rationale ?? "").trim(),
        source_excerpt: String((question as any)?.source_excerpt ?? (question as any)?.sourceExcerpt ?? (question as any)?.excerpt ?? (question as any)?.reference ?? "").trim(),
      };
    })
    .filter((question: NormalizedQuestion) => {
      if (!question.type || !question.difficulty) return false;
      if (!question.question_text || !question.correct_answer || !question.explanation || !question.source_excerpt) return false;
      if (question.type === "mcq" && question.options.length < 2) return false;
      return true;
    });

  return { questions };
}

export const generateExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch source
    const { data: src, error: srcErr } = await supabase
      .from("sources")
      .select("id, content, title")
      .eq("id", data.sourceId)
      .single();
    if (srcErr || !src) throw new Error("لم يتم العثور على المصدر");

    const content = (src.content || "").slice(0, 30000); // cap to reduce latency/truncation risk

    const difficultyAr =
      data.difficulty === "easy" ? "سهلة"
      : data.difficulty === "medium" ? "متوسطة"
      : data.difficulty === "hard" ? "صعبة"
      : "مختلطة (مزيج من السهل والمتوسط والصعب)";

    const typeAr =
      data.questionType === "mcq" ? "أسئلة اختيار من متعدد فقط (mcq)، كل سؤال له 4 خيارات"
      : data.questionType === "essay" ? "أسئلة مقالية فقط (essay)، بدون خيارات"
      : "مزيج: نصف الأسئلة تقريبًا اختيار من متعدد والنصف الآخر مقالية";

    const systemPrompt = `أنت مولّد امتحانات تعليمية. قواعد صارمة لا يجوز خرقها أبدًا:
1. اعتمد **فقط** على النص المرفق كمصدر للحقائق والأسئلة والإجابات.
2. لا تستخدم أي معلومة من خارج النص. لا تخمّن. لا تكمّل من معرفتك العامة.
3. لكل سؤال يجب أن تُرجع \`source_excerpt\`: المقطع الحرفي من النص الذي بنيت عليه السؤال.
4. إذا لم يحتوِ النص على معلومات كافية، أرجع عددًا أقل من الأسئلة بدلًا من اختلاق محتوى.
5. الأسئلة والإجابات والشرح كله باللغة العربية الفصحى الواضحة.
6. لأسئلة MCQ: 4 خيارات، خيار واحد فقط صحيح، و\`correct_answer\` يطابق نص الخيار الصحيح تمامًا.
7. لأسئلة المقال: \`correct_answer\` هو الإجابة النموذجية المختصرة.
8. إذا تضمّن النص المصدر رياضيات أو معادلات أو رموزًا علمية، فاكتب كل معادلة أو رمز بصيغة LaTeX بين علامتي $...$ (مثال: $x^2 - 5x + 6 = 0$) داخل نص السؤال والخيارات والإجابة والشرح.`;

    const userPrompt = `ولّد امتحانًا بـ${data.questionCount} سؤال.
- نوع الأسئلة: ${typeAr}
- مستوى الصعوبة: ${difficultyAr}

النص المصدر:
"""
${content}
"""`;

    const gateway = getGateway();
    const jsonInstruction = `\n\nأرجع **فقط** كائن JSON صالح بالشكل التالي بدون أي نص إضافي أو علامات code fence:
{
  "questions": [
    {
      "type": "mcq" | "essay",
      "difficulty": "easy" | "medium" | "hard",
      "question_text": "...",
      "options": ["...", "...", "...", "..."],
      "correct_answer": "...",
      "explanation": "...",
      "source_excerpt": "..."
    }
  ]
}
للأسئلة المقالية اجعل options مصفوفة فارغة [].`;

    let questions: z.infer<typeof questionSchema>[] = [];
    let lastFailure = "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const retryInstruction = attempt === 0
        ? ""
        : `\n\nالمحاولة السابقة فشلت. أصلح الإخراج فقط. تذكير صارم: أعد JSON صالحًا فقط، واجعل type و difficulty بالإنجليزية فقط، ولا تضع أي نص خارج JSON.`;

      try {
        const { text } = await generateText({
          model: gateway(MODEL),
          system: systemPrompt + jsonInstruction,
          prompt: userPrompt + retryInstruction,
        });

        const parsed = extractJsonValue(text);
        const normalized = normalizeExamPayload(parsed);
        const validation = examSchema.safeParse(normalized);

        if (validation.success && validation.data.questions.length > 0) {
          questions = validation.data.questions;
          break;
        }

        lastFailure = "استجابة النموذج غير متوافقة مع الصيغة المطلوبة.";
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.includes("429")) throw new Error("تم تجاوز الحد المسموح من الطلبات. حاول لاحقًا.");
        if (msg.includes("402")) throw new Error("نفدت رصيد الذكاء الاصطناعي. يرجى ترقية الباقة.");
        if (msg === "NO_JSON_FOUND") {
          lastFailure = "تعذر استخراج JSON صالح من استجابة النموذج.";
          continue;
        }
        lastFailure = msg;
      }
    }

    if (!questions.length) throw new Error("لم يتمكن النموذج من توليد أي سؤال من هذا المصدر");

    // Create exam
    const { data: exam, error: examErr } = await supabase
      .from("exams")
      .insert({
        user_id: userId,
        source_id: data.sourceId,
        title: data.title,
        duration_minutes: data.durationMinutes,
        question_count: questions.length,
        difficulty: data.difficulty,
        question_type: data.questionType,
        status: "ready",
        is_retraining: data.isRetraining,
      })
      .select()
      .single();
    if (examErr || !exam) throw new Error("فشل إنشاء الامتحان: " + examErr?.message);

    // Insert questions
    const rows = questions.map((q, idx) => ({
      exam_id: exam.id,
      user_id: userId,
      position: idx + 1,
      type: q.type,
      difficulty: q.difficulty,
      question_text: q.question_text,
      options: q.options && q.options.length ? q.options : null,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      source_excerpt: q.source_excerpt,
    }));
    const { error: qErr } = await supabase.from("questions").insert(rows);
    if (qErr) throw new Error("فشل حفظ الأسئلة: " + qErr.message);

    return { examId: exam.id, questionCount: questions.length };
  });

// ---------- Grade essay answer ----------
const GradeInput = z.object({
  questionId: z.string().uuid(),
  userAnswer: z.string(),
});

const gradeSchema = z.object({
  score: z.number().min(0).max(10),
  is_correct: z.boolean().describe("true if score >= 7"),
  feedback: z.string(),
});

const manualChoicesSchema = z.object({
  stem: z.string(),
  options: z.array(z.string()).min(4).max(4),
  correct_answer: z.string(),
  explanation: z.string(),
});

const manualSimilarQuestionSchema = z.object({
  type: z.enum(["mcq", "essay"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question_text: z.string(),
  options: z.array(z.string()).optional(),
  correct_answer: z.string(),
  explanation: z.string(),
});

const manualSimilarSchema = z.object({
  questions: z.array(manualSimilarQuestionSchema).min(2).max(4),
});

export const gradeEssay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GradeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: q, error } = await supabase
      .from("questions")
      .select("question_text, correct_answer, source_excerpt")
      .eq("id", data.questionId)
      .single();
    if (error || !q) throw new Error("السؤال غير موجود");

    const gateway = getGateway();
    const { object } = await generateObject({
      model: gateway(MODEL),
      schema: gradeSchema,
      system: "أنت مصحّح امتحانات منصف وعادل. قيّم إجابة الطالب بالمقارنة مع الإجابة النموذجية والمقطع المرجعي فقط. أعط درجة من 10 وملاحظات بناءة بالعربية.",
      prompt: `السؤال: ${q.question_text}

الإجابة النموذجية: ${q.correct_answer}

المقطع المرجعي: ${q.source_excerpt}

إجابة الطالب: ${data.userAnswer}

قيّم الإجابة من 10 واعتبرها صحيحة إذا كانت ≥ 7.`,
    });

    return object;
  });

export const assistManualQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ManualQuestionAssistInput.parse(d))
  .handler(async ({ data }) => {
    const gateway = getGateway();

    if (data.mode === "choices") {
      const { object } = await generateObject({
        model: gateway(MODEL),
        schema: manualChoicesSchema,
        system: `أنت خبير صياغة أسئلة تعليمية. المطلوب إكمال سؤال المستخدم بخيارات قوية فقط.
- لا تغيّر جوهر السؤال.
- أنشئ 4 خيارات قصيرة وواضحة وغير متطابقة.
- اجعل خيارًا واحدًا صحيحًا فقط.
- أعد correct_answer مطابقًا نصيًا تمامًا لأحد الخيارات.
- إن احتوى السؤال على رياضيات فاستخدم LaTeX بين $...$.
- أعد العربية الفصحى فقط.`,
        prompt: `أكمل هذا السؤال بخيارات اختيار من متعدد:
${data.questionText}`,
      });

      return { mode: "choices" as const, ...object };
    }

    const difficultyAr =
      data.difficulty === "easy" ? "سهلة"
      : data.difficulty === "medium" ? "متوسطة"
      : data.difficulty === "hard" ? "صعبة"
      : "مختلطة";

    const typeAr =
      data.questionType === "mcq" ? "اختيار من متعدد"
      : data.questionType === "essay" ? "مقالية"
      : "مزيج بين اختيار من متعدد ومقالية";

    const { object } = await generateObject({
      model: gateway(MODEL),
      schema: manualSimilarSchema,
      system: `أنت خبير توليد أسئلة مشابهة. أنشئ أسئلة جديدة تشبه صياغة السؤال الأصلي ونفس النمط المعرفي، لكن لا تنسخه حرفيًا.
- عدد الأسئلة من 2 إلى 4.
- التزم فقط بصياغة تعليمية واضحة بالعربية.
- إذا كان النوع mcq فأضف 4 خيارات مع correct_answer يطابق نص الخيار الصحيح.
- إذا كان النوع essay فلا تضف خيارات.
- إذا وُجدت معادلات فاستخدم LaTeX بين $...$.
- explanation قصيرة ومباشرة.`,
      prompt: `السؤال الأصلي:
${data.questionText}

المستوى المطلوب: ${difficultyAr}
نوع الأسئلة المطلوب: ${typeAr}`,
    });

    return { mode: "similar" as const, ...object };
  });
