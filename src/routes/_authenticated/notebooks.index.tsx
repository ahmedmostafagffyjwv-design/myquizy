import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BookIcon, masteryColor, SUBJECT_COLORS } from "@/components/notebooks/book-icon";

export const Route = createFileRoute("/_authenticated/notebooks/")({
  head: () => ({ meta: [{ title: "دفاتري الدراسية — اختبرني" }] }),
  component: Notebooks,
});

function Notebooks() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("blue");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const [{ data: subs, error }, { data: srcs }, { data: exs }] = await Promise.all([
        supabase.from("subjects").select("*").order("created_at", { ascending: false }),
        supabase.from("sources").select("id, subject_id"),
        supabase.from("exams").select("id, subject_id, score, status"),
      ]);
      if (error) throw error;
      return (subs ?? []).map((s) => {
        const ex = (exs ?? []).filter((e) => e.subject_id === s.id);
        const scored = ex.filter((e) => e.score != null);
        const mastery = scored.length ? Math.round(scored.reduce((a, e) => a + Number(e.score), 0) / scored.length) : null;
        return { ...s, sources: (srcs ?? []).filter((x) => x.subject_id === s.id).length, exams: ex.length, mastery };
      });
    },
  });

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("subjects").insert({ name: name.trim(), color });
    setSaving(false);
    if (error) return toast.error(error.message);
    setOpen(false); setName("");
    qc.invalidateQueries({ queryKey: ["subjects"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">دفاتري الدراسية</h1>
          <p className="text-sm text-muted-foreground">نظّم كل مادة في وحدات ودروس، واختبر نفسك في أي مستوى.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 ms-1" /> إضافة مادة</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !data?.length ? (
        <Card className="p-10 text-center text-muted-foreground">لا توجد مواد بعد — أضف أول مادة.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => (
            <Link key={s.id} to="/notebooks/$id" params={{ id: s.id }}>
              <Card className="p-5 flex gap-4 items-center hover:shadow-lg transition-shadow">
                <BookIcon color={s.color} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.sources} مصدر · {s.exams} امتحان</div>
                  <div className={`text-xs mt-1 font-semibold ${masteryColor(s.mastery)}`}>
                    الإتقان: {s.mastery == null ? "—" : `${s.mastery}%`}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>مادة جديدة</DialogTitle></DialogHeader>
          <Input placeholder="اسم المادة (مثلاً: الفيزياء)" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex gap-2 flex-wrap">
            {Object.keys(SUBJECT_COLORS).map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={`rounded-md p-1 border-2 ${color === c ? "border-primary" : "border-transparent"}`}>
                <BookIcon color={c} small />
              </button>
            ))}
          </div>
          <DialogFooter><Button onClick={create} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin ms-1" />}حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
