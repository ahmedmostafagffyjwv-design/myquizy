import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useServerFn } from "@tanstack/react-start";
import { generateExam, ocrImage } from "@/lib/exams.functions";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromFile, fileToBase64 } from "@/lib/file-extract";
import { toast } from "sonner";
import { Upload, FileText, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/exams/new")({
  head: () => ({ meta: [{ title: "امتحان جديد — اختبرني" }] }),
  component: NewExam,
});

function NewExam() {
  const navigate = useNavigate();
  const generate = useServerFn(generateExam);
  const ocr = useServerFn(ocrImage);

  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [extracting, setExtracting] = useState(false);

  const [examTitle, setExamTitle] = useState("");
  const [duration, setDuration] = useState(15);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [qType, setQType] = useState<"mcq" | "essay" | "mixed">("mcq");
  const [generating, setGenerating] = useState(false);

  const handleFile = async (f: File) => {
    setFile(f);
    setSourceTitle(f.name.replace(/\.[^.]+$/, ""));
    setExtracting(true);
    try {
      const text = await extractTextFromFile(f);
      if (text === "__IMAGE__") {
        toast.info("جارٍ استخراج النص من الصورة...");
        const b64 = await fileToBase64(f);
        const r = await ocr({ data: { imageBase64: b64, mimeType: f.type } });
        setRawText(r.text);
      } else {
        setRawText(text);
      }
      toast.success("تم استخراج النص بنجاح");
    } catch (e: any) {
      toast.error(e.message || "فشل استخراج النص");
    } finally {
      setExtracting(false);
    }
  };

  const goToSetup = async () => {
    if (rawText.trim().length < 200) {
      toast.error("النص قصير جدًا (يجب ٢٠٠ حرف على الأقل)");
      return;
    }
    if (!sourceTitle.trim()) sourceTitle && setSourceTitle("مصدر بدون عنوان");
    setExamTitle(sourceTitle || "امتحان جديد");
    setStep(2);
  };

  const start = async () => {
    setGenerating(true);
    try {
      // Save source
      const { data: src, error: srcErr } = await supabase
        .from("sources")
        .insert({
          user_id: (await supabase.auth.getUser()).data.user!.id,
          title: sourceTitle.trim() || "مصدر بدون عنوان",
          file_name: file?.name ?? null,
          content: rawText,
          char_count: rawText.length,
        })
        .select()
        .single();
      if (srcErr || !src) throw new Error(srcErr?.message || "فشل حفظ المصدر");

      const res = await generate({
        data: {
          sourceId: src.id,
          title: examTitle.trim() || sourceTitle.trim() || "امتحان جديد",
          durationMinutes: duration,
          questionCount: count,
          difficulty,
          questionType: qType,
          isRetraining: false,
        },
      });
      toast.success(`تم توليد ${res.questionCount} سؤال!`);
      navigate({ to: "/exams/$id", params: { id: res.examId } });
    } catch (e: any) {
      toast.error(e.message || "فشل توليد الامتحان");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">امتحان جديد</h1>
        <p className="text-muted-foreground">الخطوة {step} من ٢</p>
      </div>

      {step === 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="p-6 space-y-5">
            <div>
              <Label className="text-base font-bold mb-3 block">ارفع مصدرك التعليمي</Label>
              <label className="border-2 border-dashed rounded-xl p-8 block cursor-pointer hover:bg-accent/30 transition-colors text-center">
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.txt,image/*"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium">اضغط لاختيار ملف</p>
                <p className="text-xs text-muted-foreground mt-1">PDF · DOCX · TXT · صورة</p>
                {file && (
                  <div className="mt-4 inline-flex items-center gap-2 text-sm bg-accent text-accent-foreground rounded-full px-3 py-1">
                    <FileText className="w-3.5 h-3.5" />
                    {file.name}
                  </div>
                )}
              </label>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">أو الصق النص مباشرة</span></div>
            </div>

            <div>
              <Label>النص المستخرج / الملصوق</Label>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                placeholder="الصق محتوى مصدرك التعليمي هنا..."
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">{rawText.length} حرف</p>
            </div>

            <div>
              <Label>عنوان المصدر</Label>
              <Input value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} className="mt-2" placeholder="مثلاً: الفصل الثالث - علوم" />
            </div>

            <Button onClick={goToSetup} disabled={extracting || rawText.length < 200} className="w-full" size="lg">
              {extracting ? <><Loader2 className="w-4 h-4 animate-spin ml-2" /> جارٍ الاستخراج...</> : "التالي"}
            </Button>
          </Card>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Card className="p-6 space-y-6">
            <div>
              <Label>عنوان الامتحان</Label>
              <Input value={examTitle} onChange={(e) => setExamTitle(e.target.value)} className="mt-2" />
            </div>

            <div>
              <Label>المدة: <span className="text-primary font-bold">{duration} دقيقة</span></Label>
              <Slider value={[duration]} onValueChange={(v) => setDuration(v[0])} min={5} max={120} step={5} className="mt-3" />
            </div>

            <div>
              <Label>عدد الأسئلة: <span className="text-primary font-bold">{count}</span></Label>
              <Slider value={[count]} onValueChange={(v) => setCount(v[0])} min={3} max={25} step={1} className="mt-3" />
            </div>

            <div>
              <Label className="mb-3 block">مستوى الصعوبة</Label>
              <RadioGroup value={difficulty} onValueChange={(v: any) => setDifficulty(v)} className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { v: "easy", l: "سهل" },
                  { v: "medium", l: "متوسط" },
                  { v: "hard", l: "صعب" },
                  { v: "mixed", l: "مختلط" },
                ].map((o) => (
                  <label key={o.v} className={`border rounded-lg p-3 cursor-pointer text-center text-sm transition-colors ${difficulty === o.v ? "border-primary bg-primary/10 text-primary font-bold" : "hover:bg-accent"}`}>
                    <RadioGroupItem value={o.v} className="sr-only" />
                    {o.l}
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="mb-3 block">نوع الأسئلة</Label>
              <RadioGroup value={qType} onValueChange={(v: any) => setQType(v)} className="grid grid-cols-3 gap-2">
                {[
                  { v: "mcq", l: "اختيار من متعدد" },
                  { v: "essay", l: "مقالية" },
                  { v: "mixed", l: "مزيج" },
                ].map((o) => (
                  <label key={o.v} className={`border rounded-lg p-3 cursor-pointer text-center text-sm transition-colors ${qType === o.v ? "border-primary bg-primary/10 text-primary font-bold" : "hover:bg-accent"}`}>
                    <RadioGroupItem value={o.v} className="sr-only" />
                    {o.l}
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={generating} className="flex-1">السابق</Button>
              <Button onClick={start} disabled={generating} className="flex-1" size="lg">
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin ml-2" /> جارٍ توليد الأسئلة...</>
                ) : (
                  <><Sparkles className="w-4 h-4 ml-2" /> ابدأ الامتحان</>
                )}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
