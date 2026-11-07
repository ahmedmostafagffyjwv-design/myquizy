export type ExamOutputLanguage = "source" | "ar" | "en";
export type ResolvedOutputLanguage = "ar" | "en";

export function detectSourceLanguage(text: string): ResolvedOutputLanguage {
  const arabicLetters = text.match(/[\u0600-\u06ff]/g)?.length ?? 0;
  const latinLetters = text.match(/[A-Za-z]/g)?.length ?? 0;
  return arabicLetters >= latinLetters * 0.2 ? "ar" : "en";
}

export function resolveOutputLanguage(
  requested: ExamOutputLanguage,
  sourceText: string,
): ResolvedOutputLanguage {
  return requested === "source" ? detectSourceLanguage(sourceText) : requested;
}

export function outputLanguageLabel(language: ResolvedOutputLanguage) {
  return language === "ar" ? "Arabic" : "English";
}