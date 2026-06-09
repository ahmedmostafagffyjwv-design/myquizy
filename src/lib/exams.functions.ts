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
const GenInput = z.object({
  sourceId: z.string().uuid(),
  title: z.string().min(1).max(200),
  durationMinutes: z.number().int().min(1).max(300),
  questionCount: z.number().int().min(1).max(30),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
  questionType: z.enum(["mcq", "essay", "mixed"]),
  isRetraining: z.boolean().default(false),
  weakQuestionIds: z.array(z.string().uuid()).optional(),
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
    .map((question) => {
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
    .filter((question) => {
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

    const content = (src.content || "").slice(0, 60000); // cap to keep prompt sane

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
7. لأسئلة المقال: \`correct_answer\` هو الإجابة النموذجية المختصرة.`;

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

    let raw = "";
    try {
      const { text } = await generateText({
        model: gateway(MODEL),
        system: systemPrompt + jsonInstruction,
        prompt: userPrompt,
      });
      raw = text;
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("429")) throw new Error("تم تجاوز الحد المسموح من الطلبات. حاول لاحقًا.");
      if (msg.includes("402")) throw new Error("نفدت رصيد الذكاء الاصطناعي. يرجى ترقية الباقة.");
      throw new Error("فشل توليد الأسئلة: " + msg);
    }

    // Extract JSON from response (strip code fences / surrounding text)
    let jsonText = raw.trim();
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonText = fenceMatch[1].trim();
    const firstBrace = jsonText.indexOf("{");
    const lastBrace = jsonText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonText = jsonText.slice(firstBrace, lastBrace + 1);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error("فشل تحليل استجابة النموذج. حاول مرة أخرى.");
    }

    const looseSchema = z.object({
      questions: z.array(z.object({
        type: z.enum(["mcq", "essay"]),
        difficulty: z.enum(["easy", "medium", "hard"]),
        question_text: z.string(),
        options: z.array(z.string()).nullish(),
        correct_answer: z.string(),
        explanation: z.string(),
        source_excerpt: z.string(),
      })),
    });

    const validation = looseSchema.safeParse(parsed);
    if (!validation.success) {
      throw new Error("استجابة النموذج غير متوافقة مع الصيغة المطلوبة. حاول مرة أخرى.");
    }
    const questions = validation.data.questions;
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
