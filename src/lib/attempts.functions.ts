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

    // upsert attempt (one per question per exam)
    const { error: aErr } = await supabase
      .from("attempts")
      .insert({
        exam_id: data.examId,
        question_id: data.questionId,
        user_id: userId,
        user_answer: data.userAnswer,
        is_correct: data.isCorrect,
        score: data.score ?? (data.isCorrect ? 10 : 0),
        ai_feedback: data.aiFeedback,
      });
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
