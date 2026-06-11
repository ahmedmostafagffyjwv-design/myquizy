import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Image as ImageIcon, FunctionSquare, Calculator, Wand2, ArrowDown } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { solveMathProblem, ocrMathImage, generateSimilarMath } from "@/lib/math.functions";
import { fileToBase64 } from "@/lib/file-extract";
import { toast } from "sonner";
import { Latex, MixedLatex } from "@/components/math/Latex";
import { MathSymbolPalette } from "@/components/math/MathSymbolPalette";
import { FunctionPlot } from "@/components/math/FunctionPlot";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/math")({
  head: () => ({
    meta: [{ title: "Math AI — مساعد الرياضيات الذكي" }],
  }),
  component: MathPage,
});

function MathPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calculator className="w-7 h-7 text-primary" /> Math AI
        </h1>
        <p className="text-muted-foreground mt-1">حل المسائل خطوة بخطوة، استخراج المعادلات من الصور، ورسم الدوال</p>
      </header>

      <Tabs defaultValue="solve" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="solve"><Wand2 className="w-4 h-4 ml-1" /> الحل</TabsTrigger>
          <TabsTrigger value="ocr"><ImageIcon className="w-4 h-4 ml-1" /> صورة</TabsTrigger>
          <TabsTrigger value="plot"><FunctionSquare className="w-4 h-4 ml-1" /> رسم</TabsTrigger>
        </TabsList>

        <TabsContent value="solve" className="mt-4">
          <SolveTab />
        </TabsContent>
        <TabsContent value="ocr" className="mt-4">
          <OcrTab />
        </TabsContent>
        <TabsContent value="plot" className="mt-4">
          <Card className="p-5">
            <h2 className="font-bold mb-3">رسم الدوال</h2>
            <FunctionPlot />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ SOLVE TAB ============
function SolveTab() {
  const solve = useServerFn(solveMathProblem);
  const similar = useServerFn(generateSimilarMath);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [problem, setProblem] = useState("");
  const [studentSolution, setStudentSolution] = useState("");
  const [level, setLevel] = useState<"simple" | "detailed">("detailed");
  const [showStudent, setShowStudent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof solveMathProblem>> | null>(null);
  const [similars, setSimilars] = useState<Awaited<ReturnType<typeof generateSimilarMath>> | null>(null);

  const insertSymbol = (s: string) => {
    const ta = taRef.current;
    if (!ta) return setProblem((p) => p + s);
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = problem.slice(0, start) + s + problem.slice(end);
    setProblem(next);
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + s.indexOf("{}") + 1;
      if (s.includes("{}")) ta.setSelectionRange(caret, caret);
      else ta.setSelectionRange(start + s.length, start + s.length);
    });
  };

  const submit = async () => {
    if (!problem.trim()) return toast.error("اكتب المسألة أولاً");
    setLoading(true);
    setResult(null);
    setSimilars(null);
    try {
      const r = await solve({
        data: {
          problem,
          level,
          studentSolution: showStudent && studentSolution.trim() ? studentSolution : undefined,
        },
      });
      setResult(r);
    } catch (e: any) {
      toast.error(e.message || "تعذّر حل المسألة");
    } finally {
      setLoading(false);
    }
  };

  const makeSimilar = async (difficulty: "easier" | "same" | "harder") => {
    if (!problem.trim()) return;
    setGenLoading(true);
    try {
      const r = await similar({ data: { problem, difficulty, count: 4 } });
      setSimilars(r);
    } catch (e: any) {
      toast.error(e.message || "فشل التوليد");
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div>
          <Label className="mb-2 block">المسألة (نص عربي + LaTeX، مثلاً: حل المعادلة $x^2 - 5x + 6 = 0$)</Label>
          <Textarea
            ref={taRef}
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="اكتب مسألتك هنا..."
            rows={4}
            className="font-mono"
            dir="ltr"
          />
        </div>

        <MathSymbolPalette onInsert={insertSymbol} />

        {problem.trim() && (
          <div className="bg-muted/40 rounded-lg p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">معاينة:</p>
            <MixedLatex text={problem} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs">مستوى الشرح</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">مبسّط</SelectItem>
                <SelectItem value="detailed">مفصّل</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" type="button" onClick={() => setShowStudent((v) => !v)}>
            {showStudent ? "−" : "+"} فحص حل الطالب
          </Button>
        </div>

        {showStudent && (
          <Textarea
            value={studentSolution}
            onChange={(e) => setStudentSolution(e.target.value)}
            placeholder="الصق حل الطالب لاكتشاف الخطأ..."
            rows={3}
            className="font-mono"
            dir="ltr"
          />
        )}

        <Button onClick={submit} disabled={loading} className="w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 ml-1" /> احسب الحل</>}
        </Button>
      </Card>

      {result && (
        <Card className="p-5 space-y-4">
          {result.topic && (
            <p className="text-xs inline-block bg-primary/10 text-primary px-2 py-1 rounded-md">
              الموضوع: {result.topic}
            </p>
          )}

          {result.studentErrorAnalysis && (
            <Card className="p-3 bg-destructive/5 border-destructive/30 text-sm">
              <p className="font-bold text-destructive mb-1">تحليل خطأ الطالب</p>
              <MixedLatex text={result.studentErrorAnalysis} />
            </Card>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-1">المسألة:</p>
            <MixedLatex text={result.problemRestated} />
          </div>

          <div className="space-y-3">
            <p className="font-bold">الخطوات:</p>
            {result.steps.map((s, i) => (
              <div key={i} className="border-r-4 border-primary/50 pr-3 py-1 space-y-1">
                <p className="text-xs text-muted-foreground">الخطوة {i + 1}</p>
                <div className="overflow-x-auto">
                  <Latex tex={s.latex} block />
                </div>
                <p className="text-sm text-muted-foreground">{s.explanation}</p>
                {i < result.steps.length - 1 && <ArrowDown className="w-4 h-4 mx-auto text-muted-foreground" />}
              </div>
            ))}
          </div>

          <Card className="p-4 bg-success/5 border-success/30">
            <p className="font-bold text-success mb-2">الإجابة النهائية</p>
            <div className="text-lg overflow-x-auto">
              <Latex tex={result.finalAnswerLatex} block />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              <MixedLatex text={result.finalAnswerExplanation} />
            </p>
          </Card>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <p className="text-sm font-medium self-center ml-2">أنشئ مسائل مشابهة:</p>
            <Button size="sm" variant="outline" onClick={() => makeSimilar("easier")} disabled={genLoading}>أسهل</Button>
            <Button size="sm" variant="outline" onClick={() => makeSimilar("same")} disabled={genLoading}>نفس المستوى</Button>
            <Button size="sm" variant="outline" onClick={() => makeSimilar("harder")} disabled={genLoading}>أصعب</Button>
            {genLoading && <Loader2 className="w-4 h-4 animate-spin self-center" />}
          </div>

          {similars && (
            <div className="space-y-2">
              {similars.problems.map((p, i) => (
                <Card key={i} className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">المسألة {i + 1}</p>
                  <Latex tex={p.problemLatex} block />
                  <p className="text-xs text-muted-foreground mt-2">تلميح: {p.hint}</p>
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-primary">عرض الإجابة</summary>
                    <div className="mt-1"><Latex tex={p.answerLatex} block /></div>
                  </details>
                </Card>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ============ OCR TAB ============
function OcrTab() {
  const ocr = useServerFn(ocrMathImage);
  const solve = useServerFn(solveMathProblem);
  const [loading, setLoading] = useState(false);
  const [solving, setSolving] = useState(false);
  const [extracted, setExtracted] = useState<string>("");
  const [preview, setPreview] = useState<string | null>(null);
  const [solution, setSolution] = useState<Awaited<ReturnType<typeof solveMathProblem>> | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("ارفع صورة فقط");
    if (file.size > 8 * 1024 * 1024) return toast.error("الحجم الأقصى 8MB");
    setPreview(URL.createObjectURL(file));
    setExtracted("");
    setSolution(null);
    setLoading(true);
    try {
      const b64 = await fileToBase64(file);
      const r = await ocr({ data: { imageBase64: b64, mimeType: file.type } });
      setExtracted(r.text);
      toast.success("تم الاستخراج");
    } catch (er: any) {
      toast.error(er.message || "فشل OCR");
    } finally {
      setLoading(false);
    }
  };

  const solveExtracted = async () => {
    if (!extracted.trim()) return;
    setSolving(true);
    try {
      const r = await solve({ data: { problem: extracted, level: "detailed" } });
      setSolution(r);
    } catch (e: any) {
      toast.error(e.message || "فشل الحل");
    } finally {
      setSolving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <Label className="block mb-2">ارفع صورة سؤال رياضي</Label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
        />
        {loading && <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جاري قراءة الصورة...</p>}
      </Card>

      {preview && (
        <Card className="p-3">
          <img src={preview} alt="معاينة" className="max-h-64 mx-auto rounded" />
        </Card>
      )}

      {extracted && (
        <Card className="p-4 space-y-3">
          <div>
            <p className="text-sm font-bold mb-1">النص المستخرج:</p>
            <Textarea value={extracted} onChange={(e) => setExtracted(e.target.value)} rows={4} dir="ltr" className="font-mono" />
          </div>
          <div className="bg-muted/40 rounded-lg p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">معاينة:</p>
            <MixedLatex text={extracted} />
          </div>
          <Button onClick={solveExtracted} disabled={solving} className="w-full">
            {solving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 ml-1" /> حل المسألة المستخرجة</>}
          </Button>
        </Card>
      )}

      {solution && (
        <Card className="p-5 space-y-3">
          <p className="font-bold">الحل:</p>
          {solution.steps.map((s, i) => (
            <div key={i} className="border-r-4 border-primary/50 pr-3 py-1">
              <p className="text-xs text-muted-foreground">خطوة {i + 1}</p>
              <Latex tex={s.latex} block />
              <p className="text-sm text-muted-foreground">{s.explanation}</p>
            </div>
          ))}
          <Card className="p-3 bg-success/5 border-success/30">
            <p className="font-bold text-success">الإجابة</p>
            <Latex tex={solution.finalAnswerLatex} block />
          </Card>
        </Card>
      )}
    </div>
  );
}
