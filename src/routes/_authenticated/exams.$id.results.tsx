import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Trophy, RotateCcw, Home, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { buildExamFromMistakes } from "@/lib/attempts.functions";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/exams/$id/results")({
  head: () => ({ meta: [{ title: "نتيجة الامتحان — اختبرني" }] }),
  component: Results,
});

function Results() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["exam-results", id],
    queryFn: async () => {
      const [{ data: exam }, { data: qs }, { data: attempts }] = await Promise.all([
        supabase.from("exams").select("*").eq("id", id).single(),
        supabase.from("questions").select("*").eq("exam_id", id).order("position"),
        supabase.from("attempts").select("*").eq("exam_id", id),
      ]);
      return { exam, questions: qs || [], attempts: attempts || [] };
    },
  });

  if (isLoading || !data?.exam) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const attemptByQ: Record<string, any> = {};
  data.attempts.forEach((a: any) => { attemptByQ[a.question_id] = a; });
  const correctCount = data.attempts.filter((a: any) => a.is_correct).length;
  const score = data.exam.score ?? 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <Card className="p-8 text-center" style={{ background: "var(--gradient-primary)" }}>
          <Trophy className="w-12 h-12 mx-auto text-primary-foreground mb-3" />
          <p className="text-primary-foreground/80 text-sm mb-1">نتيجتك في "{data.exam.title}"</p>
          <p className="text-6xl font-bold text-primary-foreground">{score}%</p>
          <p className="text-primary-foreground/90 mt-2">
            {correctCount} صحيح من {data.questions.length}
          </p>
          <div className="flex gap-2 justify-center mt-6">
            <Link to="/dashboard"><Button variant="secondary"><Home className="w-4 h-4 ml-1" /> الرئيسية</Button></Link>
            <Link to="/exams/new"><Button variant="secondary"><RotateCcw className="w-4 h-4 ml-1" /> امتحان جديد</Button></Link>
          </div>
        </Card>
      </motion.div>

      <h2 className="text-xl font-bold">مراجعة الأسئلة</h2>

      <div className="space-y-3">
        {data.questions.map((q: any, i: number) => {
          const a = attemptByQ[q.id];
          const ok = a?.is_correct;
          return (
            <Card key={q.id} className="p-5">
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${ok ? "bg-success/20 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="font-bold">{i + 1}. {q.question_text}</p>
                  <div className="text-sm">
                    <p className="text-muted-foreground">إجابتك:</p>
                    <p className={ok ? "text-success" : "text-destructive"}>{a?.user_answer || <em className="text-muted-foreground">لم تُجب</em>}</p>
                  </div>
                  {!ok && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">الإجابة الصحيحة:</p>
                      <p className="text-success">{q.correct_answer}</p>
                    </div>
                  )}
                  {q.explanation && (
                    <div className="text-sm bg-muted rounded-lg p-3">
                      <p className="font-medium mb-1">الشرح:</p>
                      <p className="text-muted-foreground">{q.explanation}</p>
                    </div>
                  )}
                  {a?.ai_feedback && (
                    <div className="text-sm bg-accent/40 rounded-lg p-3">
                      <p className="font-medium mb-1">ملاحظات المصحّح:</p>
                      <p className="text-muted-foreground">{a.ai_feedback}</p>
                      {a.score !== null && <p className="text-xs mt-1 font-bold">الدرجة: {a.score}/10</p>}
                    </div>
                  )}
                  {q.source_excerpt && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">عرض المرجع من المصدر</summary>
                      <p className="mt-2 italic bg-muted p-2 rounded border-r-2 border-primary">{q.source_excerpt}</p>
                    </details>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
