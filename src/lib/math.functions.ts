import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-2.5-flash";
const VISION_MODEL = "google/gemini-2.5-flash";

function getGateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  return createLovableAiGatewayProvider(key);
}

// ============ 1. Solve a math problem step-by-step ============
const SolveInput = z.object({
  problem: z.string().min(1).max(4000),
  level: z.enum(["simple", "detailed"]).default("detailed"),
  studentSolution: z.string().max(4000).optional(), // إن وُجد، نفحص الخطأ
});

const solutionSchema = z.object({
  problemRestated: z.string(),
  steps: z.array(
    z.object({
      latex: z.string(),
      explanation: z.string(),
    })
  ),
  finalAnswerLatex: z.string(),
  finalAnswerExplanation: z.string(),
  studentErrorAnalysis: z.string().optional(),
  topic: z.string().optional(),
});

export const solveMathProblem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SolveInput.parse(d))
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const detailHint =
      data.level === "simple"
        ? "اجعل الشرح موجزاً ومناسباً للمبتدئين."
        : "اشرح كل خطوة بتفصيل واذكر القاعدة الرياضية المستخدمة.";
    const studentBlock = data.studentSolution
      ? `\n\nحل الطالب:\n${data.studentSolution}\n\nراجع حل الطالب وحدّد الخطوة الخاطئة (إن وُجدت) واشرح الخطأ في studentErrorAnalysis.`
      : "";

    const { object } = await generateObject({
      model: gateway(MODEL),
      schema: solutionSchema,
      prompt: `أنت معلم رياضيات خبير. حل المسألة التالية خطوة بخطوة.
- كل خطوة يجب أن تحتوي على معادلة بصيغة LaTeX (بدون $$ في latex، فقط المحتوى).
- استخدم اللغة العربية في الشرح.
- ${detailHint}
- اذكر اسم الموضوع الرياضي في topic (مثلاً: "حل المعادلات التربيعية").

المسألة:
${data.problem}${studentBlock}`,
    });
    return object;
  });

// ============ 2. OCR a math image (extract LaTeX) ============
const OcrMathInput = z.object({
  imageBase64: z.string().min(10),
  mimeType: z.string().default("image/jpeg"),
});

export const ocrMathImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OcrMathInput.parse(d))
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const dataUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:${data.mimeType};base64,${data.imageBase64}`;

    const { text } = await generateText({
      model: gateway(VISION_MODEL),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `استخرج المسألة الرياضية من هذه الصورة.
- أعد المعادلات بصيغة LaTeX داخل علامات $...$ للسطر و $$...$$ للسطر المنفصل.
- احتفظ بالنص العربي/الإنجليزي كما هو.
- لا تحل المسألة، فقط استخرجها كما هي.`,
            },
            { type: "image", image: dataUrl } as any,
          ] as any,
        },
      ],
    });
    return { text };
  });

// ============ 3. Generate similar problems ============
const SimilarInput = z.object({
  problem: z.string().min(1).max(2000),
  difficulty: z.enum(["easier", "same", "harder"]).default("same"),
  count: z.number().int().min(1).max(8).default(4),
});

const similarSchema = z.object({
  problems: z.array(
    z.object({
      problemLatex: z.string(),
      hint: z.string(),
      answerLatex: z.string(),
    })
  ),
});

export const generateSimilarMath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SimilarInput.parse(d))
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const diffMap = {
      easier: "أسهل قليلاً",
      same: "بنفس المستوى",
      harder: "أصعب قليلاً",
    } as const;
    const { object } = await generateObject({
      model: gateway(MODEL),
      schema: similarSchema,
      prompt: `أنشئ ${data.count} مسائل رياضية ${diffMap[data.difficulty]} مشابهة للفكرة التالية.
- استخدم LaTeX في problemLatex و answerLatex (بدون $).
- اكتب hint قصير باللغة العربية.

المسألة الأصلية:
${data.problem}`,
    });
    return object;
  });
