// Single source of truth for Gemini model names used by the past-exams feature.
// gemini-3.8-flash كان يعمل سابقاً لكنه يعيد 503 (High Demand) بشكل متكرر حالياً،
// فتم التحويل للنسخة المستقرة الأسرع. لاستعادته غيّر القيم الثلاث أدناه فقط.
export const ANALYSIS_MODEL = "gemini-3-flash-preview"; // تحليل الامتحان المرجعي
export const GENERATION_MODEL = "gemini-3-flash-preview"; // توليد الأسئلة
export const VERIFY_MODEL = "gemini-3-flash-preview"; // التحقق من الإجابات
