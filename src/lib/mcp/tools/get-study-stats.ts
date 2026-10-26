import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_study_stats",
  title: "Get study stats",
  description:
    "Summarize the signed-in user's study activity: number of exams, completed exams, average score, mistake-bank size, mastered questions, and number of uploaded sources.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated. Connect through the app's OAuth flow first." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const [examsRes, weakRes, sourcesRes] = await Promise.all([
      supabase.from("exams").select("id, status, score"),
      supabase.from("weak_questions").select("id, mastered"),
      supabase.from("sources").select("id"),
    ]);
    for (const res of [examsRes, weakRes, sourcesRes]) {
      if (res.error) return { content: [{ type: "text", text: res.error.message }], isError: true };
    }
    const exams = examsRes.data ?? [];
    const weak = weakRes.data ?? [];
    const sources = sourcesRes.data ?? [];
    const completed = exams.filter((e) => e.status === "completed");
    const avg = completed.length
      ? Math.round(completed.reduce((acc, e) => acc + (e.score ?? 0), 0) / completed.length)
      : 0;
    const stats = {
      exams_total: exams.length,
      exams_completed: completed.length,
      average_score_percent: avg,
      weak_questions_total: weak.length,
      weak_not_mastered: weak.filter((w) => !w.mastered).length,
      sources_total: sources.length,
    };
    const lines = [
      `Exams: ${stats.exams_total} (${stats.exams_completed} completed, avg ${stats.average_score_percent}%)`,
      `Mistake bank: ${stats.weak_questions_total} questions, ${stats.weak_not_mastered} not mastered`,
      `Sources: ${stats.sources_total}`,
    ];
    return {
      content: [{ type: "text", text: lines.join("\n") }],
      structuredContent: stats,
    };
  },
});
