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

function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay) && dateDelay > 0) return dateDelay;
  }
  return Math.min(1000 * 2 ** attempt + Math.floor(Math.random() * 500), 8000);
}

function retryDelayForError(error: unknown, attempt: number) {
  if (error && typeof error === "object") {
    const value = error as { retryAfterMs?: unknown; responseHeaders?: HeadersInit };
    if (typeof value.retryAfterMs === "number" && value.retryAfterMs > 0) return value.retryAfterMs;
    if (value.responseHeaders) {
      const retryAfter = new Headers(value.responseHeaders).get("retry-after");
      if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
        const dateDelay = Date.parse(retryAfter) - Date.now();
        if (Number.isFinite(dateDelay) && dateDelay > 0) return dateDelay;
      }
    }
  }
  return Math.min(1000 * 2 ** attempt + Math.floor(Math.random() * 500), 8000);
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
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
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
      lastError = error;
      const status = errorStatus(error);
      if ((status === 429 || (status !== undefined && status >= 500)) && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayForError(error, attempt)));
        continue;
      }
      throw new Error(userFacingAIError(error));
    }
  }
  throw new Error(userFacingAIError(lastError));
}

export async function generateDeepStructured<TSchema extends z.ZodType>(
  gateway: ReturnType<typeof createDeepReasoningGateway>,
  schema: TSchema,
  instructions: string,
  userContent: ModelMessage["content"],
): Promise<z.infer<TSchema>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
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
      lastError = error;
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
      const status = errorStatus(error);
      if ((status === 429 || (status !== undefined && status >= 500)) && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayForError(error, attempt)));
        continue;
      }
      throw new Error(userFacingAIError(error));
    }
  }
  throw new Error(userFacingAIError(lastError));
}

export async function gatewayFetchWithRetry(input: RequestInfo | URL, init?: RequestInit) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(input, init);
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= 3) return response;
    const delay = retryDelay(response, attempt);
    await response.body?.cancel().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
