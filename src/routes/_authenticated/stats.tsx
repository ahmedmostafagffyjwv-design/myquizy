import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({ meta: [{ title: "إحصائيات الأداء — اختبرني" }] }),
  component: Stats,
});

function Stats() {
  const { data, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const [{ data: exams }, { data: weak }] = await Promise.all([
        supabase.from("exams").select("*").eq("status", "completed").order("completed_at"),
        supabase.from("weak_questions").select("mastered"),
      ]);
      return { exams: exams || [], weak: weak || [] };
    },
  });

  if (isLoading) return <Loader2 className="animate-spin mx-auto mt-20" />;

  const scoreTrend = (data?.exams || []).map((e: any, i: number) => ({
    name: `#${i + 1}`,
    score: e.score,
  }));

  const diffDist: Record<string, number> = {};
  (data?.exams || []).forEach((e: any) => { diffDist[e.difficulty] = (diffDist[e.difficulty] || 0) + 1; });
  const diffArr = Object.entries(diffDist).map(([k, v]) => ({ name: difLabel(k), count: v }));

  const mastered = (data?.weak || []).filter((w: any) => w.mastered).length;
  const total = data?.weak.length || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2"><BarChart3 className="w-7 h-7" /> الإحصائيات</h1>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-5"><p className="text-xs text-muted-foreground">امتحانات منجزة</p><p className="text-2xl font-bold">{data?.exams.length}</p></Card>
        <Card className="p-5"><p className="text-xs text-muted-foreground">المتوسط العام</p><p className="text-2xl font-bold text-primary">{data?.exams.length ? Math.round(data.exams.reduce((a: number, e: any) => a + (e.score || 0), 0) / data.exams.length) : 0}%</p></Card>
        <Card className="p-5"><p className="text-xs text-muted-foreground">نسبة إتقان الأخطاء</p><p className="text-2xl font-bold text-success">{total ? Math.round((mastered / total) * 100) : 0}%</p></Card>
      </div>

      <Card className="p-6">
        <h3 className="font-bold mb-4">تطور النتائج عبر الوقت</h3>
        {scoreTrend.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={scoreTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis domain={[0, 100]} stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-muted-foreground text-sm text-center py-8">لا توجد بيانات بعد</p>}
      </Card>

      <Card className="p-6">
        <h3 className="font-bold mb-4">توزيع الامتحانات حسب الصعوبة</h3>
        {diffArr.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={diffArr}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-muted-foreground text-sm text-center py-8">لا توجد بيانات بعد</p>}
      </Card>
    </div>
  );
}

function difLabel(d: string) {
  return d === "easy" ? "سهل" : d === "medium" ? "متوسط" : d === "hard" ? "صعب" : "مختلط";
}
