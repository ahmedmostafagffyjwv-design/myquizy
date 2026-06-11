import { useMemo, useState } from "react";
import { create, all } from "mathjs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const math = create(all, {});

type Series = { name: string; expr: string; color: string };

const COLORS = ["hsl(220 80% 55%)", "hsl(340 75% 55%)", "hsl(150 60% 45%)", "hsl(35 85% 55%)"];

export function FunctionPlot() {
  const [exprInput, setExprInput] = useState("x^2 - 4");
  const [series, setSeries] = useState<Series[]>([
    { name: "f1", expr: "x^2 - 4", color: COLORS[0] },
  ]);
  const [xMin, setXMin] = useState(-10);
  const [xMax, setXMax] = useState(10);

  const addSeries = () => {
    if (!exprInput.trim() || series.length >= 4) return;
    setSeries([
      ...series,
      { name: `f${series.length + 1}`, expr: exprInput.trim(), color: COLORS[series.length] },
    ]);
  };

  const removeSeries = (i: number) => setSeries(series.filter((_, idx) => idx !== i));

  const { paths, viewBox, yMin, yMax, roots } = useMemo(() => {
    const W = 600;
    const H = 360;
    const samples = 400;
    const dx = (xMax - xMin) / samples;
    const seriesPoints: { color: string; pts: [number, number][]; roots: number[] }[] = [];

    for (const s of series) {
      const pts: [number, number][] = [];
      const rts: number[] = [];
      let prevY: number | null = null;
      let prevX = xMin;
      try {
        const node = math.parse(s.expr);
        const compiled = node.compile();
        for (let i = 0; i <= samples; i++) {
          const x = xMin + i * dx;
          let y: number;
          try {
            y = compiled.evaluate({ x });
            if (typeof y !== "number" || !isFinite(y)) {
              pts.push([x, NaN]);
              prevY = null;
              continue;
            }
          } catch {
            pts.push([x, NaN]);
            prevY = null;
            continue;
          }
          // detect sign change (root)
          if (prevY !== null && Math.sign(prevY) !== Math.sign(y) && Math.abs(y - prevY) < 50) {
            const xRoot = prevX - prevY * (dx / (y - prevY));
            rts.push(xRoot);
          }
          pts.push([x, y]);
          prevY = y;
          prevX = x;
        }
      } catch {
        // bad expression — skip
      }
      seriesPoints.push({ color: s.color, pts, roots: rts });
    }

    // compute y range
    const ys = seriesPoints.flatMap((s) => s.pts.map(([, y]) => y)).filter((y) => isFinite(y));
    let yMin = ys.length ? Math.min(...ys) : -10;
    let yMax = ys.length ? Math.max(...ys) : 10;
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }
    // clamp insane ranges
    const yRange = yMax - yMin;
    if (yRange > 200) {
      const mid = (yMin + yMax) / 2;
      yMin = mid - 100;
      yMax = mid + 100;
    }

    const toX = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
    const toY = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;

    const paths = seriesPoints.map((s) => {
      let d = "";
      let moveNext = true;
      for (const [x, y] of s.pts) {
        if (!isFinite(y) || y < yMin - 1000 || y > yMax + 1000) {
          moveNext = true;
          continue;
        }
        d += `${moveNext ? "M" : "L"}${toX(x).toFixed(2)},${toY(y).toFixed(2)} `;
        moveNext = false;
      }
      return { d, color: s.color, roots: s.roots.map((x) => ({ x: toX(x), label: x.toFixed(2) })) };
    });

    return { paths, viewBox: `0 0 ${W} ${H}`, yMin, yMax, roots: seriesPoints.flatMap((s) => s.roots) };
  }, [series, xMin, xMax]);

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-[1fr_auto] gap-2">
        <Input
          value={exprInput}
          onChange={(e) => setExprInput(e.target.value)}
          placeholder="مثال: x^2 - 4، sin(x)، 1/x، sqrt(x)+1"
          className="font-mono"
          dir="ltr"
        />
        <Button onClick={addSeries} disabled={series.length >= 4}>
          + إضافة دالة
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {series.map((s, i) => (
          <div key={i} className="flex items-center gap-2 bg-muted rounded-md px-2 py-1 text-xs">
            <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
            <span className="font-mono">{s.name}(x) = {s.expr}</span>
            <button onClick={() => removeSeries(i)} className="text-destructive hover:text-destructive/80">×</button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">x من</Label>
          <Input type="number" value={xMin} onChange={(e) => setXMin(Number(e.target.value))} dir="ltr" />
        </div>
        <div>
          <Label className="text-xs">x إلى</Label>
          <Input type="number" value={xMax} onChange={(e) => setXMax(Number(e.target.value))} dir="ltr" />
        </div>
      </div>

      <div className="border rounded-lg bg-card overflow-x-auto">
        <svg viewBox={viewBox} className="w-full h-auto max-h-[360px]" preserveAspectRatio="xMidYMid meet">
          {/* grid */}
          {Array.from({ length: 11 }).map((_, i) => {
            const x = (600 / 10) * i;
            const y = (360 / 10) * i;
            return (
              <g key={i} stroke="hsl(var(--border))" strokeWidth="0.5" opacity={i === 5 ? 0.8 : 0.3}>
                <line x1={x} y1={0} x2={x} y2={360} />
                <line x1={0} y1={y} x2={600} y2={y} />
              </g>
            );
          })}
          {/* axes labels */}
          <text x="595" y="190" fontSize="10" fill="hsl(var(--muted-foreground))" textAnchor="end">x</text>
          <text x="305" y="12" fontSize="10" fill="hsl(var(--muted-foreground))">y</text>
          {/* functions */}
          {paths.map((p, i) => (
            <g key={i}>
              <path d={p.d} stroke={p.color} fill="none" strokeWidth="2" />
              {p.roots.map((r, j) => (
                <circle key={j} cx={r.x} cy={180} r={4} fill={p.color} stroke="white" strokeWidth="1.5" />
              ))}
            </g>
          ))}
        </svg>
      </div>

      {roots.length > 0 && (
        <p className="text-xs text-muted-foreground">
          الجذور التقريبية (تقاطعات مع المحور x): {roots.slice(0, 8).map((r) => r.toFixed(3)).join(", ")}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        y: [{yMin.toFixed(2)}, {yMax.toFixed(2)}] — يدعم: + - * / ^، sin/cos/tan، log/ln/exp، sqrt، abs، pi، e
      </p>
    </div>
  );
}
