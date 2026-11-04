// Direct Google Gemini API client (uses the user's own GEMINI_API_KEY, server-only).
export const QUOTA_MESSAGE = "تم بلوغ الحد المجاني، حاول لاحقاً";

export class GeminiQuotaError extends Error {
  constructor() {
    super(QUOTA_MESSAGE);
    this.name = "GeminiQuotaError";
  }
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function geminiGenerate(opts: {
  model: string;
  system?: string;
  text: string;
  images?: string[]; // data URLs
  json?: boolean;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("متغير البيئة GEMINI_API_KEY غير مُعدّ في أسرار المشروع");

  const parts: Part[] = [{ text: opts.text }];
  for (const url of opts.images ?? []) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(url);
    if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
  }
  const body = {
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    contents: [{ role: "user", parts }],
    generationConfig: opts.json ? { responseMimeType: "application/json" } : undefined,
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`;

  const maxRetries = 3;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status === 503) {
      if (attempt >= maxRetries) {
        if (res.status === 429) throw new GeminiQuotaError();
        throw new Error("خوادم Gemini تحت ضغط مؤقت، حاول بعد قليل");
      }
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt)); // 2s, 4s, 8s
      continue;
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Gemini error", res.status, errText.slice(0, 500));
      throw new Error(`فشل الاتصال بـ Gemini (${res.status})`);
    }
    const json: any = await res.json();
    const text = (json?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p?.text ?? "")
      .join("");
    if (!text) throw new Error("استجابة فارغة من Gemini");
    return text;
  }
}
