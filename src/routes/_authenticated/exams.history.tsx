import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, ChevronLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/exams/history")({
  head: () => ({ meta: [{ title: "سجل الامتحانات — اختبرني" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["exams-history"],
    queryFn: async () => {
      const { data } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2"><History className="w-7 h-7" /> سجل الامتحانات</h1>
        <Link to="/exams/new"><Button>امتحان جديد</Button></Link>
      </div>

      {isLoading ? <Loader2 className="animate-spin mx-auto mt-10" /> : data?.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">لا توجد امتحانات بعد.</Card>
      ) : (
        <div className="space-y-2">
          {data?.map((e: any) => (
            <Card key={e.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("ar-EG")} · {e.question_count} سؤال · {e.duration_minutes}د
                </p>
              </div>
              <div className="flex items-center gap-3">
                {e.status === "completed" ? (
                  <>
                    <span className={`font-bold text-lg ${(e.score ?? 0) >= 70 ? "text-success" : (e.score ?? 0) >= 50 ? "text-warning" : "text-destructive"}`}>{e.score}%</span>
                    <Button size="sm" variant="outline" onClick={() => navigate({ to: "/exams/$id/results", params: { id: e.id } })}>
                      المراجعة <ChevronLeft className="w-3 h-3 mr-1" />
                    </Button>
                  </>
                ) : (
                  <Link to="/exams/$id" params={{ id: e.id }}><Button size="sm">متابعة</Button></Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
