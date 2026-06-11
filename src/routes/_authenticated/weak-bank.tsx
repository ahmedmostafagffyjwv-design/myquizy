import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Filter,
  Repeat,
  Calendar,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateExam } from "@/lib/exams.functions";
import { buildExamFromMistakes } from "@/lib/attempts.functions";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/weak-bank")({
  head: () => ({ meta: [{ title: "بنك الأخطاء — اختبرني" }] }),
  component: WeakBank,
});

type Diag = { fetchedAt: number; durationMs: number; count: number; status: "ok" | "error"; error?: string };

function WeakBank() {
  const navigate = useNavigate();
  const generate = useServerFn(generateExam);
  const buildFromMistakes = useServerFn(buildExamFromMistakes);
  const [retraining, setRetraining] = useState(false);
  const [buildingAll, setBuildingAll] = useState(false);
  const [buildingRepeated, setBuildingRepeated] = useState(false);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [diag, setDiag] = useState<Diag | null>(null);
  const [showDiag, setShowDiag] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["weak-bank"],
    queryFn: async () => {
      const t0 = performance.now();
      try {
        const { data: weak, error } = await supabase
          .from("weak_questions")
          .select("*, questions(id, question_text, type, difficulty, exam_id), sources(id, title)")
          .order("last_attempt_at", { ascending: false });
        const dt = Math.round(performance.now() - t0);
        if (error) {
          setDiag({ fetchedAt: Date.now(), durationMs: dt, count: 0, status: "error", error: error.message });
          throw new Error(error.message);
        }
        setDiag({ fetchedAt: Date.now(), durationMs: dt, count: weak?.length || 0, status: "ok" });
        return weak || [];
      } catch (e: any) {
        const dt = Math.round(performance.now() - t0);
        setDiag({ fetchedAt: Date.now(), durationMs: dt, count: 0, status: "error", error: e.message });
        throw e;
      }
    },
    retry: 1,
    staleTime: 30_000,
  });

  // derive available sources for the filter
  const sourceOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data || []).forEach((w: any) => {
      if (w.source_id && w.sources?.title) map.set(w.source_id, w.sources.title);
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [data]);

  const filtered = useMemo(() => {
    return (data || []).filter((w: any) => {
      if (filterSource !== "all" && w.source_id !== filterSource) return false;
      if (filterDifficulty !== "all" && w.questions?.difficulty !== filterDifficulty) return false;
      return true;
    });
  }, [data, filterSource, filterDifficulty]);

  const active = filtered.filter((w: any) => !w.mastered);
  const mastered = filtered.filter((w: any) => w.mastered);
  const repeated = active.filter((w: any) => w.times_wrong >= 2);
  const totalAttempts = filtered.reduce((s: number, w: any) => s + w.times_correct + w.times_wrong, 0);
  const totalCorrect = filtered.reduce((s: number, w: any) => s + w.times_correct, 0);
  const masteryPct = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  // suggested next review: items not attempted in last 2 days
  const dueForReview = active.filter((w: any) => {
    const last = new Date(w.last_attempt_at).getTime();
    return Date.now() - last > 2 * 24 * 60 * 60 * 1000;
  }).length;

  const startRetraining = async () => {
    const sourceCounts: Record<string, number> = {};
    active.forEach((w: any) => {
      if (w.source_id) sourceCounts[w.source_id] = (sourceCounts[w.source_id] || 0) + 1;
    });
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
      const res = await buildFromMistakes({
        data: {
          scope: "all",
          filterSourceId: filterSource !== "all" ? filterSource : undefined,
          filterDifficulty: filterDifficulty !== "all" ? (filterDifficulty as any) : undefined,
        },
      });
      toast.success(`جاهز! تم تجميع ${res.count} سؤال`);
      navigate({ to: "/exams/$id", params: { id: res.examId } });
    } catch (e: any) {
      toast.error(e.message || "تعذّر إنشاء الامتحان");
      setBuildingAll(false);
    }
  };

  const buildRepeatedExam = async () => {
    setBuildingRepeated(true);
    try {
      const res = await buildFromMistakes({
        data: {
          scope: "all",
          repeatedOnly: true,
          filterSourceId: filterSource !== "all" ? filterSource : undefined,
          filterDifficulty: filterDifficulty !== "all" ? (filterDifficulty as any) : undefined,
        },
      });
      toast.success(`تم تجميع ${res.count} سؤال متكرر`);
      navigate({ to: "/exams/$id", params: { id: res.examId } });
    } catch (e: any) {
      toast.error(e.message || "تعذّر إنشاء الامتحان");
      setBuildingRepeated(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-warning" /> بنك الأخطاء
          </h1>
          <p className="text-muted-foreground mt-1">راجع الأسئلة التي أخطأت فيها وأعد التدريب حتى تتقنها</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ml-1 ${isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDiag((v) => !v)}>
            تشخيص
          </Button>
        </div>
      </div>

      {showDiag && (
        <Card className="p-4 bg-muted/40 text-sm font-mono space-y-1">
          <p>الحالة: {diag?.status === "ok" ? "✅ ok" : diag?.status === "error" ? "❌ error" : "—"}</p>
          <p>عدد العناصر المسترجعة: {diag?.count ?? "—"}</p>
          <p>زمن الاستجابة: {diag?.durationMs ?? "—"} ms</p>
          <p>آخر تحميل: {diag?.fetchedAt ? new Date(diag.fetchedAt).toLocaleTimeString("ar-EG") : "—"}</p>
          {diag?.error && <p className="text-destructive break-all">الخطأ: {diag.error}</p>}
        </Card>
      )}

      {/* Error state — replaces infinite loading */}
      {isError && (
        <Card className="p-6 border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-destructive shrink-0" />
            <div className="flex-1">
              <h3 className="font-bold text-destructive">تعذّر تحميل بنك الأخطاء</h3>
              <p className="text-sm text-muted-foreground mt-1 break-words">
                {(error as any)?.message || "حدث خطأ غير متوقع. تحقّق من اتصالك بالإنترنت."}
              </p>
              <Button size="sm" className="mt-3" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 ml-1" /> إعادة المحاولة
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading && !isError && (
        <Card className="p-8 flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">جاري تحميل بنك الأخطاء...</p>
        </Card>
      )}

      {!isLoading && !isError && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">يحتاج تدريب</p>
              <p className="text-2xl font-bold text-warning">{active.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">تم إتقانها</p>
              <p className="text-2xl font-bold text-success">{mastered.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">أخطاء متكررة</p>
              <p className="text-2xl font-bold text-destructive">{repeated.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> مستحق المراجعة
              </p>
              <p className="text-2xl font-bold text-primary">{dueForReview}</p>
            </Card>
          </div>

          {/* Mastery progress */}
          {totalAttempts > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">معدل التحسن</span>
                <span className="text-muted-foreground">{masteryPct}%</span>
              </div>
              <Progress value={masteryPct} />
            </Card>
          )}

          {/* Filters */}
          {(data?.length || 0) > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-3">
                <Filter className="w-4 h-4" /> تصفية
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Select value={filterSource} onValueChange={setFilterSource}>
                  <SelectTrigger><SelectValue placeholder="المادة / المصدر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المصادر</SelectItem>
                    {sourceOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                  <SelectTrigger><SelectValue placeholder="مستوى الصعوبة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المستويات</SelectItem>
                    <SelectItem value="easy">سهل</SelectItem>
                    <SelectItem value="medium">متوسط</SelectItem>
                    <SelectItem value="hard">صعب</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          )}

          {/* Action cards */}
          {active.length > 0 && (
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-5 flex flex-col gap-3" style={{ background: "var(--gradient-primary)" }}>
                <div className="text-primary-foreground">
                  <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-5 h-5" /> امتحان من كل الأخطاء</h3>
                  <p className="text-xs opacity-90 mt-1">بنفس الأسئلة، بدون تكرار</p>
                </div>
                <Button variant="secondary" size="sm" onClick={buildAllMistakesExam} disabled={buildingAll} className="self-start">
                  {buildingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : "ابدأ"}
                </Button>
              </Card>

              <Card className="p-5 flex flex-col gap-3 border-destructive/40">
                <div>
                  <h3 className="font-bold flex items-center gap-2"><Repeat className="w-5 h-5 text-destructive" /> الأخطاء المتكررة</h3>
                  <p className="text-xs text-muted-foreground mt-1">الأسئلة التي أخطأت فيها مرتين أو أكثر</p>
                </div>
                <Button variant="outline" size="sm" onClick={buildRepeatedExam} disabled={buildingRepeated || repeated.length === 0} className="self-start">
                  {buildingRepeated ? <Loader2 className="w-4 h-4 animate-spin" /> : `ابدأ (${repeated.length})`}
                </Button>
              </Card>

              <Card className="p-5 flex flex-col gap-3 border-primary/40">
                <div>
                  <h3 className="font-bold">أسئلة جديدة بالذكاء</h3>
                  <p className="text-xs text-muted-foreground mt-1">يولّد أسئلة جديدة من نفس المصدر</p>
                </div>
                <Button variant="outline" size="sm" onClick={startRetraining} disabled={retraining} className="self-start">
                  {retraining ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4 ml-1" /> ابدأ</>}
                </Button>
              </Card>
            </div>
          )}

          {/* List */}
          {filtered.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto text-success mb-2" />
              <p className="font-medium">لا توجد أخطاء مطابقة</p>
              <p className="text-xs mt-1">
                {(data?.length || 0) === 0 ? "لم تخطئ في أي سؤال بعد — تابع التدريب!" : "جرّب تغيير التصفية"}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {[...active, ...mastered].map((w: any) => (
                <Card key={w.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium line-clamp-2">{w.questions?.question_text}</p>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                      <span>من: {w.sources?.title || "—"}</span>
                      <span>·</span>
                      <span>صعوبة: {w.questions?.difficulty || "—"}</span>
                      <span>·</span>
                      <span className="text-destructive">أخطأت {w.times_wrong}×</span>
                      <span>·</span>
                      <span className="text-success">صحيح {w.times_correct}×</span>
                    </div>
                  </div>
                  {w.mastered ? (
                    <span className="text-xs text-success flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-4 h-4" /> أُتقن
                    </span>
                  ) : w.times_wrong >= 2 ? (
                    <span className="text-xs text-destructive shrink-0">متكرر</span>
                  ) : (
                    <span className="text-xs text-warning shrink-0">يحتاج مراجعة</span>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
