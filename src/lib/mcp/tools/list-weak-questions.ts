import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const toWeakJson = (w: {
  id: string;
  times_wrong: number;
  times_correct: number;
  mastered: boolean | null;
  last_attempt_at: string;
  questions: {
    id: string;
    question_text: string;
    type: string | null;
    difficulty: string | null;
    explanation: string | null;
  } | null;
}) => ({
  id: w.id,
  question_id: w.questions?.id ?? null,
  question_text: w.questions?.question_text ?? null,
  type: w.questions?.type ?? null,
  difficulty: w.questions?.difficulty ?? null,
  explanation: w.questions?.explanation ?? null,
  times_wrong: w.times_wrong,
  times_correct: w.times_correct,
  mastered: w.mastered,
  last_attempt_at: w.last_attempt_at,
});

export default defineTool({
  name: "list_weak_questions",
  title: "List mistake bank",
  description:
    "List the signed-in user's mistake bank (weak questions): which questions they got wrong, how often, and whether they are mastered. Includes the question text and explanation.",
  inputSchema: {
    mastered: z
      .enum(["all", "not_mastered", "mastered"])
      .default("not_mastered")
      .describe("Filter by mastery. Default shows only not-yet-mastered questions."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum number of entries to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (args, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated. Connect through the app's OAuth flow first." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("weak_questions")
      .select("id, times_wrong, times_correct, mastered, last_attempt_at, questions!weak_questions_question_id_fkey(id, question_text, type, difficulty, explanation)")
      .order("times_wrong", { ascending: false })
      .limit(args.limit);
    if (args.mastered === "not_mastered") query = query.eq("mastered", false);
    if (args.mastered === "mastered") query = query.eq("mastered", true);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const weak = ((data ?? []) as any[]).map((w) => toWeakJson({ ...w, questions: Array.isArray(w.questions) ? w.questions[0] ?? null : w.questions }));
    return {
      content: [{ type: "text", text: weak.length === 0 ? "The mistake bank is empty for this filter." : weak.map((w) => `${w.id}: (wrong x${w.times_wrong}) ${w.question_text ?? "question removed"}`).join("\n") }],
      structuredContent: { weak_questions: weak },
    };
  },
});
