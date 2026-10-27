import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const toQuestionJson = (q: {
  id: string;
  position: number;
  type: string;
  difficulty: string;
  question_text: string;
  options: unknown;
  correct_answer: string;
  explanation: string | null;
  source_excerpt: string | null;
  image_url: string | null;
  question_kind: string | null;
}) => ({
  id: q.id,
  position: q.position,
  type: q.type,
  difficulty: q.difficulty,
  question_text: q.question_text,
  options: q.options,
  correct_answer: q.correct_answer,
  explanation: q.explanation,
  source_excerpt: q.source_excerpt,
  image_url: q.image_url,
  question_kind: q.question_kind,
});

export default defineTool({
  name: "get_exam",
  title: "Get exam with questions",
  description:
    "Fetch one exam of the signed-in user together with all its questions (text, options, correct answer, explanation, source excerpt). Use list_exams first to find the exam id.",
  inputSchema: {
    exam_id: z.string().uuid().describe("The exam id returned by list_exams."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (args, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated. Connect through the app's OAuth flow first." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: exam, error } = await supabase
      .from("exams")
      .select("id, title, status, score, difficulty, question_type, question_shape, duration_minutes, question_count, is_retraining, created_at, completed_at")
      .eq("id", args.exam_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!exam) return { content: [{ type: "text", text: `No exam found with id ${args.exam_id}.` }], isError: true };

    const { data: questions, error: qError } = await supabase
      .from("questions")
      .select("id, position, type, difficulty, question_text, options, correct_answer, explanation, source_excerpt, image_url, question_kind")
      .eq("exam_id", args.exam_id)
      .order("position", { ascending: true });
    if (qError) return { content: [{ type: "text", text: qError.message }], isError: true };

    const examJson = JSON.parse(JSON.stringify(exam)) as any;
    const questionsJson = JSON.parse(JSON.stringify(questions ?? [])) as any[];
    return {
      content: [{ type: "text", text: `${examJson.title} — ${examJson.status}${examJson.score !== null ? ` — ${examJson.score}%` : ""} — ${questionsJson.length} questions.` }],
      structuredContent: { exam: examJson, questions: questionsJson } as any,
    };
  },
});
