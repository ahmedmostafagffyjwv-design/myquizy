import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { MixedLatex } from "@/components/math/Latex";

const SYMBOLS: { label: string; insert: string }[] = [
  { label: "x²", insert: "^{2}" },
  { label: "xⁿ", insert: "^{}" },
  { label: "√", insert: "\\sqrt{}" },
  { label: "a/b", insert: "\\frac{}{}" },
  { label: "π", insert: "\\pi" },
  { label: "θ", insert: "\\theta" },
  { label: "α", insert: "\\alpha" },
  { label: "β", insert: "\\beta" },
  { label: "Δ", insert: "\\Delta" },
  { label: "∞", insert: "\\infty" },
  { label: "±", insert: "\\pm" },
  { label: "×", insert: "\\times" },
  { label: "÷", insert: "\\div" },
  { label: "≤", insert: "\\le" },
  { label: "≥", insert: "\\ge" },
  { label: "≠", insert: "\\ne" },
  { label: "≈", insert: "\\approx" },
  { label: "∫", insert: "\\int_{}^{}" },
  { label: "Σ", insert: "\\sum_{}^{}" },
  { label: "lim", insert: "\\lim_{x \\to }" },
  { label: "sin", insert: "\\sin" },
  { label: "cos", insert: "\\cos" },
  { label: "log", insert: "\\log" },
  { label: "→", insert: "\\rightarrow" },
];

export function MathInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (snippet: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    // Wrap in $...$ unless cursor is already inside an open math segment
    const inMath = (before.match(/\$/g)?.length ?? 0) % 2 === 1;
    const text = inMath ? snippet : `$${snippet}$`;
    const next = before + text + after;
    onChange(next);
    const braceIdx = text.indexOf("{}");
    const caret = start + (braceIdx >= 0 ? braceIdx + 1 : inMath ? text.length : text.length - 1);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const hasMath = value.includes("$");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-2" dir="ltr">
        {SYMBOLS.map((s) => (
          <button
            key={s.label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(s.insert)}
            className="min-w-9 rounded-md border bg-background px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            {s.label}
          </button>
        ))}
      </div>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder="اكتب إجابتك هنا... استخدم الأزرار أعلاه لإدراج الرموز الرياضية"
      />
      {hasMath && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          <p className="mb-1 text-xs text-muted-foreground">معاينة:</p>
          <MixedLatex text={value} />
        </div>
      )}
    </div>
  );
}
