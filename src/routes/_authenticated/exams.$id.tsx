import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useServerFn } from "@tanstack/react-start";
import { gradeEssay } from "@/lib/exams.functions";
import { saveAttempt, finishExam } from "@/lib/attempts.functions";
import { toast } from "sonner";
import { Clock, ChevronLeft, ChevronRight, Loader2, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/exams/$id")({
  head: () => ({ meta: [{ title: "خوض الامتحان — اختبرني" }] }),
  component: TakeExam,
});

type Q = {
  id: string;
  position: number;
  type: "mcq" | "essay";
  difficulty: string;
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string | null;
  source_excerpt: string | null;
};

function TakeExam() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const grade = useServerFn(gradeEssay);
  const save = useServerFn(saveAttempt);
  const finish = useServerFn(finishExam);

  const { data, isLoading } = useQuery({
    queryKey: ["exam", id],
    queryFn: async () => {
      const [{ data: exam }, { data: qs }] = await Promise.all([
        supabase.from("exams").select("*").eq("id", id).single(),
        supabase.from("questions").select("*").eq("exam_id", id).order("position"),
      ]);
      return { exam, questions: (qs || []) as Q[] };
    },
  });

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // start timer
  useEffect(() => {
    if (!data?.exam) return;
    const startedAt = data.exam.started_at ? new Date(data.exam.started_at) : new Date();
    if (!data.exam.started_at) {
      supabase.from("exams").update({ started_at: startedAt.toISOString(), status: "in_progress" }).eq("id", id);
    }
    const totalMs = data.exam.duration_minutes * 60_000;
    const tick = () => {
      const left = Math.max(0, startedAt.getTime() + totalMs - Date.now());
      setTimeLeft(left);
      if (left === 0) submitAll();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.exam?.id]);

  const questions = data?.questions ?? [];
  const current = questions[idx];
  const answered = useMemo(() => Object.keys(answers).filter((k) => answers[k]?.trim()).length, [answers]);

  if (isLoading || !data?.exam) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (data.exam.status === "completed") {
    navigate({ to: "/exams/$id/results", params: { id } });
    return null;
  }

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const submitAll = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Save all answered
      for (const q of questions) {
        const ans = (answers[q.id] || "").trim();
        if (!ans) {
          await save({ data: { examId: id, questionId: q.id, userAnswer: "", isCorrect: false, score: 0 } });
          continue;
        }
        if (q.type === "mcq") {
          const isCorrect = ans === q.correct_answer;
          await save({ data: { examId: id, questionId: q.id, userAnswer: ans, isCorrect, score: isCorrect ? 10 : 0 } });
        } else {
          const g = await grade({ data: { questionId: q.id, userAnswer: ans } });
          await save({ data: { examId: id, questionId: q.id, userAnswer: ans, isCorrect: g.is_correct, score: g.score, aiFeedback: g.feedback } });
        }
      }
      await finish({ data: { examId: id } });
      toast.success("تم تسليم الامتحان!");
      navigate({ to: "/exams/$id/results", params: { id } });
    } catch (e: any) {
      toast.error(e.message || "فشل التسليم");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* header */}
      <Card className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-bold truncate">{data.exam.title}</h1>
          <p className="text-xs text-muted-foreground">{idx + 1} من {questions.length} · أُجيب على {answered}</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono font-bold ${(timeLeft ?? 0) < 60_000 ? "bg-destructive/15 text-destructive" : "bg-accent text-accent-foreground"}`}>
          <Clock className="w-4 h-4" />
          {timeLeft !== null ? fmt(timeLeft) : "—"}
        </div>
      </Card>

      <Progress value={((idx + 1) / questions.length) * 100} />

      <AnimatePresence mode="wait">
        {current && (
          <motion.div key={current.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
            <Card className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  {current.type === "mcq" ? "اختيار من متعدد" : "سؤال مقالي"} · {difLabel(current.difficulty)}
                </span>
                {current.source_excerpt && (
                  <Button variant="ghost" size="sm" onClick={() => setShowSource((v) => !v)}>
                    <BookOpen className="w-4 h-4 ml-1" />
                    {showSource ? "إخفاء" : "عرض"} المرجع
                  </Button>
                )}
              </div>

              <h2 className="text-lg md:text-xl font-bold leading-relaxed">{current.question_text}</h2>

              {showSource && current.source_excerpt && (
                <div className="text-sm bg-muted p-3 rounded-lg border-r-4 border-primary text-muted-foreground italic">
                  {current.source_excerpt}
                </div>
              )}

              {current.type === "mcq" && current.options && (
                <div className="space-y-2">
                  {current.options.map((opt, i) => {
                    const selected = answers[current.id] === opt;
                    return (
                      <button
                        key={i}
                        onClick={() => setAnswers((a) => ({ ...a, [current.id]: opt }))}
                        className={`w-full text-right p-4 rounded-xl border transition-all ${selected ? "border-primary bg-primary/10 font-bold text-primary" : "hover:border-primary/50 hover:bg-accent/30"}`}
                      >
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs ml-3 font-bold">
                          {["أ", "ب", "ج", "د"][i]}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {current.type === "essay" && (
                <Textarea
                  value={answers[current.id] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [current.id]: e.target.value }))}
                  rows={6}
                  placeholder="اكتب إجابتك هنا..."
                />
              )}

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
                  <ChevronRight className="w-4 h-4 ml-1" /> السابق
                </Button>
                {idx === questions.length - 1 ? (
                  <Button onClick={submitAll} disabled={submitting} className="bg-success hover:bg-success/90 text-success-foreground">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "تسليم الامتحان"}
                  </Button>
                ) : (
                  <Button onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}>
                    التالي <ChevronLeft className="w-4 h-4 mr-1" />
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* question dots */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setIdx(i)}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${i === idx ? "bg-primary text-primary-foreground" : answers[q.id] ? "bg-success/20 text-success" : "bg-muted text-muted-foreground hover:bg-accent"}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

function difLabel(d: string) {
  return d === "easy" ? "سهل" : d === "medium" ? "متوسط" : d === "hard" ? "صعب" : d;
}
