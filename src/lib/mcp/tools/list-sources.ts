import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

const toSourceJson = (s: {
  id: string;
  title: string;
  file_name: string | null;
  char_count: number;
  content_nature: string | null;
  created_at: string;
}) => ({
  id: s.id,
  title: s.title,
  file_name: s.file_name,
  char_count: s.char_count,
  content_nature: s.content_nature,
  created_at: s.created_at,
});

export default defineTool({
  name: "list_sources",
  title: "List study sources",
  description:
    "List the signed-in user's uploaded study sources (documents used to generate exams). Returns titles and metadata, not full document text.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated. Connect through the app's OAuth flow first." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("sources")
      .select("id, title, file_name, char_count, content_nature, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const sources = (data ?? []).map(toSourceJson);
    return {
      content: [{ type: "text", text: sources.length === 0 ? "No sources uploaded yet." : sources.map((s) => `${s.id}: ${s.title}${s.file_name ? ` (${s.file_name})` : ""}`).join("\n") }],
      structuredContent: { sources },
    };
  },
});
