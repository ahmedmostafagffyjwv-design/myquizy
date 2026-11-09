import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";
import type { z } from "zod";
import { DEEP_REASONING_MODEL } from "./ai-models";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "./ai-gateway-run-id.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

export function createLovableAiGatewayProvider(lovableApiKey: string, request?: Request) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: GATEWAY_URL,
    supportsStructuredOutputs: true,
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch,
  });

  return provider;
}

export function createDeepReasoningGateway(lovableApiKey: string, request?: Request) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey: lovableApiKey,
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch,
  });
  return { model: provider.responses(DEEP_REASONING_MODEL), runIdFetch };
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = error as { statusCode?: unknown; status?: unknown; cause?: unknown };
  if (typeof value.statusCode === "number") return value.statusCode;
  if (typeof value.status === "number") return value.status;
  return value.cause ? errorStatus(value.cause) : undefined;
}

function userFacingAIError(error: unknown) {
  const status = errorStatus(error);
  if (status === 402) return "نفدت أرصدة الذكاء الاصطناعي. أضف رصيدًا للمتابعة.";
  if (status === 429) return "تم تجاوز الحد المسموح من الطلبات. حاول لاحقًا.";
  if (status === 401) return "تعذّر إعداد خدمة الذكاء الاصطناعي. أعد المحاولة لاحقًا.";
  if (status === 403 && error instanceof Error) return error.message;
  if (status && status >= 500) return "خدمة الذكاء الاصطناعي مشغولة مؤقتًا. حاول لاحقًا.";
  return "تعذّر إكمال طلب الذكاء الاصطناعي. حاول لاحقًا.";
}

export async function generateDeepText(
  gateway: ReturnType<typeof createDeepReasoningGateway>,
  instructions: string,
  userContent: ModelMessage["content"],
): Promise<string> {
  const result = streamText({
    model: gateway.model,
    instructions,
    messages: [{ role: "user", content: userContent }],
    output: Output.text(),
    maxRetries: 0,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    return await result.text;
  } catch (error) {
    throw new Error(userFacingAIError(error));
  }
}

export async function generateDeepStructured<TSchema extends z.ZodType>(
  gateway: ReturnType<typeof createDeepReasoningGateway>,
  schema: TSchema,
  instructions: string,
  userContent: ModelMessage["content"],
): Promise<z.infer<TSchema>> {
  const result = streamText({
    model: gateway.model,
    instructions,
    messages: [{ role: "user", content: userContent }],
    output: Output.object({ schema }),
    maxRetries: 0,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    return await result.output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const text = error.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      try {
        const recovered = schema.safeParse(JSON.parse(text));
        if (recovered.success) return recovered.data;
      } catch {
        // Preserve a clean schema error instead of exposing provider internals.
      }
      throw new Error("تعذّر التحقق من صيغة الاستجابة. حاول مرة أخرى.");
    }
    throw new Error(userFacingAIError(error));
  }
}
