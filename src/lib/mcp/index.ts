import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listExamsTool from "./tools/list-exams";
import getExamTool from "./tools/get-exam";
import listWeakQuestionsTool from "./tools/list-weak-questions";
import listSourcesTool from "./tools/list-sources";
import getStudyStatsTool from "./tools/get-study-stats";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "edugenius-ai",
  title: "EduGenius AI",
  version: "0.1.0",
  instructions:
    "Tools for EduGenius AI, an Arabic exam-generation study app. After connecting with OAuth, callers can read the signed-in user's exams (list_exams, get_exam), their mistake bank (list_weak_questions), uploaded study sources (list_sources) and study statistics (get_study_stats). All tools read the caller's own data through RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listExamsTool, getExamTool, listWeakQuestionsTool, listSourcesTool, getStudyStatsTool],
});
