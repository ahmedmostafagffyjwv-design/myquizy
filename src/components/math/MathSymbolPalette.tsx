import { Button } from "@/components/ui/button";

const SYMBOLS: { label: string; insert: string }[] = [
  { label: "x²", insert: "^{2}" },
  { label: "xⁿ", insert: "^{}" },
  { label: "√", insert: "\\sqrt{}" },
  { label: "ⁿ√", insert: "\\sqrt[n]{}" },
  { label: "a/b", insert: "\\frac{a}{b}" },
  { label: "π", insert: "\\pi" },
  { label: "θ", insert: "\\theta" },
  { label: "∞", insert: "\\infty" },
  { label: "≤", insert: "\\le " },
  { label: "≥", insert: "\\ge " },
  { label: "≠", insert: "\\ne " },
  { label: "±", insert: "\\pm " },
  { label: "∫", insert: "\\int_{}^{} " },
  { label: "Σ", insert: "\\sum_{}^{} " },
  { label: "lim", insert: "\\lim_{x \\to }" },
  { label: "d/dx", insert: "\\frac{d}{dx}" },
  { label: "sin", insert: "\\sin(" },
  { label: "cos", insert: "\\cos(" },
  { label: "tan", insert: "\\tan(" },
  { label: "log", insert: "\\log(" },
  { label: "ln", insert: "\\ln(" },
  { label: "e^x", insert: "e^{}" },
  { label: "(   )", insert: "()" },
  { label: "[   ]", insert: "[]" },
];

export function MathSymbolPalette({ onInsert }: { onInsert: (s: string) => void }) {
  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 p-3 bg-muted/40 rounded-lg border">
      {SYMBOLS.map((s) => (
        <Button
          key={s.label}
          type="button"
          variant="outline"
          size="sm"
          className="h-9 px-2 text-sm font-mono"
          onClick={() => onInsert(s.insert)}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}
