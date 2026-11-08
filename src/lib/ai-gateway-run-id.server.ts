const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;

  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);

      for (let attempt = 0; ; attempt += 1) {
        const response = await fetch(input, { ...init, headers });
        runId ??= response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt >= 3) return response;

        const retryAfter = response.headers.get("retry-after");
        let delay = 1000 * 2 ** attempt + Math.floor(Math.random() * 500);
        if (retryAfter) {
          const seconds = Number(retryAfter);
          if (Number.isFinite(seconds)) delay = Math.max(0, seconds * 1000);
          else {
            const dateDelay = Date.parse(retryAfter) - Date.now();
            if (Number.isFinite(dateDelay) && dateDelay > 0) delay = dateDelay;
          }
        }
        await response.body?.cancel().catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    },
    getRunId: () => runId,
  };
}

export function getLovableAiGatewayRunId(request?: Request) {
  return request?.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
}