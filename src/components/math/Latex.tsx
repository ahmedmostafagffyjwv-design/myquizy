import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

export function Latex({ tex, block = false }: { tex: string; block?: boolean }) {
  if (!tex?.trim()) return null;
  const clean = tex.replace(/^\$+|\$+$/g, "").trim();
  try {
    return block ? <BlockMath math={clean} /> : <InlineMath math={clean} />;
  } catch {
    return <code className="text-destructive">{clean}</code>;
  }
}

/**
 * Renders mixed Arabic text + inline ($...$) and block ($$...$$) LaTeX.
 */
export function MixedLatex({ text }: { text: string }) {
  if (!text) return null;
  // split keeping delimiters
  const parts = text.split(/(\$\$[^$]+\$\$|\$[^$\n]+\$)/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (p.startsWith("$$") && p.endsWith("$$")) {
          return <Latex key={i} tex={p.slice(2, -2)} block />;
        }
        if (p.startsWith("$") && p.endsWith("$")) {
          return <Latex key={i} tex={p.slice(1, -1)} />;
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}
