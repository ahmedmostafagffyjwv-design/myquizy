import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const toExamJson = (e: {
  id: string;
  title: string;
  status: string;
  score: number | null;
  difficulty: string;
  question_type: string;
  question_shape: string | null;
  duration_minutes: number;
  question_count: number;
  is_retraining: boolean | null;
  created_at: string;
  completed_at: string | null;
}) => ({
  id: e.id,
  title: e.title,
  status: e.status,
  score: e.score,
  difficulty: e.difficulty,
  question_type: e.question_type,
  question_shape: e.question_shape,
  duration_minutes: e.duration_minutes,
  question_count: e.question_count,
  is_retraining: e.is_retraining,
  created_at: e.created_at,
  completed_at: e.completed_at,
});

export default defineTool({
  name: "list_exams",
  title: "List exams",
  description:
    "List the signed-in user's generated exams (title, status, score, difficulty, dates). Use get_exam to fetch an exam's full questions.",
  inputSchema: {
    status: z
      .enum(["all", "pending", "completed"])
      .default("all")
      .describe("Filter by exam status. 'pending' means not yet taken."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum number of exams to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (args, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated. Connect through the app's OAuth flow first." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("exams")
      .select("id, title, status, score, difficulty, question_type, question_shape, duration_minutes, question_count, is_retraining, created_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(args.limit);
    if (args.status !== "all") query = query.eq("status", args.status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const exams = (data ?? []).map(toExamJson);
    return {
      content: [{ type: "text", text: exams.length === 0 ? "No exams found." : exams.map((e) => `${e.id}: ${e.title} — ${e.status}${e.score !== null ? ` — ${e.score}%` : ""}`).join("\n") }],
      structuredContent: { exams },
    };
  },
});
