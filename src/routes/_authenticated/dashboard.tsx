import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, History, AlertTriangle, TrendingUp, FileText } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة التحكم — اختبرني" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [examsRes, weakRes, sourcesRes] = await Promise.all([
        supabase.from("exams").select("id, score, status, created_at, title").order("created_at", { ascending: false }).limit(5),
        supabase.from("weak_questions").select("id, mastered"),
        supabase.from("sources").select("id"),
      ]);
      const exams = examsRes.data || [];
      const weak = weakRes.data || [];
      const completed = exams.filter(e => e.status === "completed");
      const avg = completed.length ? Math.round(completed.reduce((a, e) => a + (e.score || 0), 0) / completed.length) : 0;
      return {
        recentExams: exams,
        examCount: exams.length,
        sourceCount: (sourcesRes.data || []).length,
        weakCount: weak.filter(w => !w.mastered).length,
        avg,
      };
    },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-1">أهلاً بك من جديد 👋</h1>
        <p className="text-muted-foreground">جاهز لاختبار جديد؟ اختر مصدرك وابدأ.</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="الامتحانات" value={stats?.examCount ?? 0} icon={FileText} />
        <StatCard label="المصادر" value={stats?.sourceCount ?? 0} icon={FileText} />
        <StatCard label="بنك الأخطاء" value={stats?.weakCount ?? 0} icon={AlertTriangle} />
        <StatCard label="متوسط النتائج" value={`${stats?.avg ?? 0}%`} icon={TrendingUp} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-6 md:col-span-2 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate({ to: "/exams/new" })} style={{ background: "var(--gradient-primary)" }}>
          <div className="flex items-center justify-between text-primary-foreground">
            <div>
              <h3 className="text-xl font-bold mb-1">ابدأ امتحانًا جديدًا</h3>
              <p className="text-sm opacity-90">ارفع مصدرك واترك الذكاء الاصطناعي يولّد لك أسئلتك</p>
            </div>
            <PlusCircle className="w-10 h-10 opacity-90" />
          </div>
        </Card>
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate({ to: "/weak-bank" })}>
          <AlertTriangle className="w-8 h-8 text-warning mb-2" />
          <h3 className="font-bold mb-1">إعادة تدريب</h3>
          <p className="text-xs text-muted-foreground">راجع نقاط ضعفك</p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><History className="w-5 h-5" /> آخر الامتحانات</h2>
          <Link to="/exams/history"><Button variant="ghost" size="sm">عرض الكل</Button></Link>
        </div>
        {stats?.recentExams.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">لا توجد امتحانات بعد. ابدأ امتحانك الأول!</p>
        ) : (
          <ul className="divide-y">
            {stats?.recentExams.map((e: any) => (
              <li key={e.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString("ar-EG")}</p>
                </div>
                <div className="flex items-center gap-2">
                  {e.status === "completed" ? (
                    <span className="text-sm font-bold text-success">{e.score}%</span>
                  ) : (
                    <Link to="/exams/$id" params={{ id: e.id }}><Button size="sm" variant="outline">متابعة</Button></Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: any; icon: any }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </Card>
  );
}
