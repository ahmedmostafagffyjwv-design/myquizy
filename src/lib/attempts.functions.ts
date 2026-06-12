import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SaveAttemptInput = z.object({
  examId: z.string().uuid(),
  questionId: z.string().uuid(),
  userAnswer: z.string(),
  isCorrect: z.boolean(),
  score: z.number().min(0).max(10).optional(),
  aiFeedback: z.string().optional(),
});

export const saveAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveAttemptInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // real upsert — unique constraint (user_id, exam_id, question_id) prevents duplicates
    const { error: aErr } = await supabase
      .from("attempts")
      .upsert(
        {
          exam_id: data.examId,
          question_id: data.questionId,
          user_id: userId,
          user_answer: data.userAnswer,
          is_correct: data.isCorrect,
          score: data.score ?? (data.isCorrect ? 10 : 0),
          ai_feedback: data.aiFeedback,
        },
        { onConflict: "user_id,exam_id,question_id" },
      );
    if (aErr) throw new Error(aErr.message);

    // weak bank
    const { data: exam } = await supabase
      .from("exams")
      .select("source_id")
      .eq("id", data.examId)
      .single();

    const { data: existing } = await supabase
      .from("weak_questions")
      .select("id, times_wrong, times_correct")
      .eq("user_id", userId)
      .eq("question_id", data.questionId)
      .maybeSingle();

    if (data.isCorrect) {
      if (existing) {
        const newCorrect = existing.times_correct + 1;
        await supabase
          .from("weak_questions")
          .update({
            times_correct: newCorrect,
            last_attempt_at: new Date().toISOString(),
            mastered: newCorrect >= 2 && newCorrect > existing.times_wrong,
          })
          .eq("id", existing.id);
      }
    } else {
      if (existing) {
        await supabase
          .from("weak_questions")
          .update({
            times_wrong: existing.times_wrong + 1,
            last_attempt_at: new Date().toISOString(),
            mastered: false,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("weak_questions").insert({
          user_id: userId,
          question_id: data.questionId,
          source_id: exam?.source_id ?? null,
        });
      }
    }
    return { ok: true };
  });

const FinishInput = z.object({ examId: z.string().uuid() });

export const finishExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FinishInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: attempts } = await supabase
      .from("attempts")
      .select("score, is_correct")
      .eq("exam_id", data.examId)
      .eq("user_id", userId);

    const total = attempts?.length || 0;
    const sum = (attempts || []).reduce((acc, a) => acc + (a.score ?? 0), 0);
    const score = total ? Math.round((sum / (total * 10)) * 100) : 0;

    await supabase
      .from("exams")
      .update({ status: "completed", score, completed_at: new Date().toISOString() })
      .eq("id", data.examId);

    return { score, total };
  });

// Build a brand-new exam from previously-missed questions.
// scope = "all" -> uses every still-unmastered weak_question for the user
// scope = "exam" -> uses only wrong attempts from one specific source exam
const BuildFromMistakesInput = z.object({
  scope: z.enum(["all", "exam"]),
  sourceExamId: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
  filterSourceId: z.string().uuid().optional(),
  filterDifficulty: z.enum(["easy", "medium", "hard"]).optional(),
  repeatedOnly: z.boolean().optional(),
});

export const buildExamFromMistakes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BuildFromMistakesInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let questionIds: string[] = [];
    if (data.scope === "all") {
      let q = supabase
        .from("weak_questions")
        .select("question_id, times_wrong, source_id")
        .eq("user_id", userId)
        .eq("mastered", false);
      if (data.filterSourceId) q = q.eq("source_id", data.filterSourceId);
      if (data.repeatedOnly) q = q.gte("times_wrong", 2);
      const { data: weak, error } = await q.order("times_wrong", { ascending: false }).limit(50);
      if (error) throw new Error(error.message);
      questionIds = Array.from(new Set((weak || []).map((w) => w.question_id)));
    } else {
      if (!data.sourceExamId) throw new Error("sourceExamId مطلوب");
      const { data: wrong, error } = await supabase
        .from("attempts")
        .select("question_id")
        .eq("user_id", userId)
        .eq("exam_id", data.sourceExamId)
        .eq("is_correct", false);
      if (error) throw new Error(error.message);
      questionIds = Array.from(new Set((wrong || []).map((w) => w.question_id)));
    }

    if (data.filterDifficulty && questionIds.length > 0) {
      const { data: filtered } = await supabase
        .from("questions")
        .select("id")
        .in("id", questionIds)
        .eq("difficulty", data.filterDifficulty);
      questionIds = (filtered || []).map((q) => q.id);
    }

    if (questionIds.length === 0) {
      throw new Error("لا توجد أسئلة خاطئة لإعادة اختبارها");
    }

    const { data: originals, error: qErr } = await supabase
      .from("questions")
      .select("*")
      .in("id", questionIds)
      .eq("user_id", userId);
    if (qErr) throw new Error(qErr.message);
    if (!originals || originals.length === 0) {
      throw new Error("تعذّر استرجاع الأسئلة الأصلية");
    }

    const { data: srcExam } = await supabase
      .from("exams")
      .select("source_id")
      .eq("id", originals[0].exam_id)
      .maybeSingle();

    const title =
      data.title ??
      (data.scope === "all"
        ? "امتحان مجمَّع من كل الأخطاء"
        : "إعادة اختبار أخطاء هذا الامتحان");

    const { data: newExam, error: eErr } = await supabase
      .from("exams")
      .insert({
        user_id: userId,
        source_id: srcExam?.source_id ?? null,
        title,
        duration_minutes: Math.max(5, Math.min(60, originals.length * 2)),
        question_count: originals.length,
        difficulty: "mixed",
        question_type: "mixed",
        status: "pending",
        is_retraining: true,
      })
      .select("id")
      .single();
    if (eErr || !newExam) throw new Error(eErr?.message || "فشل إنشاء الامتحان");

    const shuffled = [...originals].sort(() => Math.random() - 0.5);
    const cloned = shuffled.map((q, i) => ({
      exam_id: newExam.id,
      user_id: userId,
      position: i + 1,
      type: q.type,
      difficulty: q.difficulty,
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      source_excerpt: q.source_excerpt,
      image_url: q.image_url,
    }));
    const { error: insErr } = await supabase.from("questions").insert(cloned);
    if (insErr) throw new Error(insErr.message);

    return { examId: newExam.id, count: cloned.length };
  });
