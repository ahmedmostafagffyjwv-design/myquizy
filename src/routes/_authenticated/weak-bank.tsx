import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateExam } from "@/lib/exams.functions";
import { buildExamFromMistakes } from "@/lib/attempts.functions";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/weak-bank")({
  head: () => ({ meta: [{ title: "بنك الأخطاء — اختبرني" }] }),
  component: WeakBank,
});

function WeakBank() {
  const navigate = useNavigate();
  const generate = useServerFn(generateExam);
  const buildFromMistakes = useServerFn(buildExamFromMistakes);
  const [retraining, setRetraining] = useState(false);
  const [buildingAll, setBuildingAll] = useState(false);


  const { data, isLoading } = useQuery({
    queryKey: ["weak-bank"],
    queryFn: async () => {
      const { data: weak } = await supabase
        .from("weak_questions")
        .select("*, questions(id, question_text, type, difficulty, exam_id), sources(id, title)")
        .order("last_attempt_at", { ascending: false });
      return weak || [];
    },
  });

  const active = data?.filter((w: any) => !w.mastered) || [];
  const mastered = data?.filter((w: any) => w.mastered) || [];

  const startRetraining = async () => {
    // Pick most-relevant source from weak items
    const sourceCounts: Record<string, number> = {};
    active.forEach((w: any) => { if (w.source_id) sourceCounts[w.source_id] = (sourceCounts[w.source_id] || 0) + 1; });
    const topSourceId = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!topSourceId) return toast.error("لا توجد مصادر مرتبطة بالأخطاء");

    setRetraining(true);
    try {
      const res = await generate({
        data: {
          sourceId: topSourceId,
          title: "إعادة تدريب على نقاط الضعف",
          durationMinutes: 10,
          questionCount: Math.min(active.length, 10),
          difficulty: "mixed",
          questionType: "mixed",
          isRetraining: true,
        },
      });
      toast.success("جاهز للتدريب!");
      navigate({ to: "/exams/$id", params: { id: res.examId } });
    } catch (e: any) {
      toast.error(e.message || "فشل");
      setRetraining(false);
    }
  };

  const buildAllMistakesExam = async () => {
    setBuildingAll(true);
    try {
      const res = await buildFromMistakes({ data: { scope: "all" } });
      toast.success(`جاهز! تم تجميع ${res.count} سؤال`);
      navigate({ to: "/exams/$id", params: { id: res.examId } });
    } catch (e: any) {
      toast.error(e.message || "تعذّر إنشاء الامتحان");
      setBuildingAll(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><AlertTriangle className="w-7 h-7 text-warning" /> بنك الأخطاء</h1>
        <p className="text-muted-foreground mt-1">راجع الأسئلة التي أخطأت فيها وأعد التدريب حتى تتقنها</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">يحتاج تدريب</p>
          <p className="text-3xl font-bold text-warning">{active.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">تم إتقانها</p>
          <p className="text-3xl font-bold text-success">{mastered.length}</p>
        </Card>
      </div>

      {active.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 flex flex-col gap-3" style={{ background: "var(--gradient-primary)" }}>
            <div className="text-primary-foreground">
              <h3 className="font-bold text-lg flex items-center gap-2"><Sparkles className="w-5 h-5" /> امتحان مجمَّع من كل أخطائك</h3>
              <p className="text-sm opacity-90 mt-1">يعيد طرح نفس الأسئلة التي أخطأت فيها — بدون تكرار</p>
            </div>
            <Button variant="secondary" onClick={buildAllMistakesExam} disabled={buildingAll} className="self-start">
              {buildingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 ml-1" /> ابدأ الآن</>}
            </Button>
          </Card>
          <Card className="p-6 flex flex-col gap-3 border-primary/40">
            <div>
              <h3 className="font-bold text-lg">إعادة تدريب بأسئلة جديدة</h3>
              <p className="text-sm text-muted-foreground mt-1">يولّد أسئلة جديدة بالذكاء الاصطناعي من نفس المصدر</p>
            </div>
            <Button variant="outline" onClick={startRetraining} disabled={retraining} className="self-start">
              {retraining ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4 ml-1" /> ابدأ</>}
            </Button>
          </Card>
        </div>
      )}


      {isLoading ? <Loader2 className="animate-spin mx-auto mt-10" /> : (
        <div className="space-y-2">
          {[...active, ...mastered].map((w: any) => (
            <Card key={w.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium line-clamp-2">{w.questions?.question_text}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  من: {w.sources?.title || "—"} · أخطأت {w.times_wrong}× · أجبت صحيح {w.times_correct}×
                </p>
              </div>
              {w.mastered ? (
                <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> أُتقن</span>
              ) : (
                <span className="text-xs text-warning">يحتاج مراجعة</span>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
