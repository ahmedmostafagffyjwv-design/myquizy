import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateExam } from "@/lib/exams.functions";
import { extractDocumentAssets } from "@/lib/file-extract";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowRight, FileText, FolderPlus, Loader2, Pencil, Play, Plus, Trash2, Upload } from "lucide-react";
import { BookIcon, masteryColor } from "@/components/notebooks/book-icon";

export const Route = createFileRoute("/_authenticated/notebooks/$id")({
  head: () => ({ meta: [{ title: "دفتر المادة — اختبرني" }] }),
  component: Notebook,
});

type Scope = { level: "subject" | "unit" | "lesson"; id: string; name: string; unitId?: string };

function Notebook() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const generate = useServerFn(generateExam);
  const key = ["notebook", id];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [s, u, l, src, ex] = await Promise.all([
        supabase.from("subjects").select("*").eq("id", id).single(),
        supabase.from("subject_units").select("*").eq("subject_id", id).order("position").order("created_at"),
        supabase.from("subject_lessons").select("*").order("position").order("created_at"),
        supabase.from("sources").select("id, title, char_count, unit_id, lesson_id, created_at").eq("subject_id", id).order("created_at"),
        supabase.from("exams").select("id, title, score, status, unit_id, lesson_id, created_at").eq("subject_id", id).order("created_at", { ascending: false }),
      ]);
      if (s.error) throw s.error;
      const units = u.data ?? [];
      const unitIds = new Set(units.map((x) => x.id));
      return { subject: s.data, units, lessons: (l.data ?? []).filter((x) => unitIds.has(x.unit_id)), sources: src.data ?? [], exams: ex.data ?? [] };
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["subjects"] }); };

  // dialogs
  const [rename, setRename] = useState<{ table: "subjects" | "subject_units" | "subject_lessons"; id: string; name: string } | null>(null);
  const [addSrc, setAddSrc] = useState<Scope | null>(null);
  const [examScope, setExamScope] = useState<Scope | null>(null);

  if (isLoading || !data) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const { subject, units, lessons, sources, exams } = data;

  const sourcesFor = (sc: Scope) =>
    sc.level === "subject" ? sources : sc.level === "unit" ? sources.filter((s) => s.unit_id === sc.id) : sources.filter((s) => s.lesson_id === sc.id);
  const masteryFor = (filter: (e: (typeof exams)[number]) => boolean) => {
    const sc = exams.filter(filter).filter((e) => e.score != null);
    return sc.length ? Math.round(sc.reduce((a, e) => a + Number(e.score), 0) / sc.length) : null;
  };

  const addUnit = async () => {
    const { error } = await supabase.from("subject_units").insert({ subject_id: id, name: `وحدة ${units.length + 1}`, position: units.length });
    if (error) toast.error(error.message); else refresh();
  };
  const addLesson = async (unitId: string) => {
    const n = lessons.filter((l) => l.unit_id === unitId).length;
    const { error } = await supabase.from("subject_lessons").insert({ unit_id: unitId, name: `درس ${n + 1}`, position: n });
    if (error) toast.error(error.message); else refresh();
  };
  const remove = async (table: "subject_units" | "subject_lessons" | "sources", rid: string) => {
    if (!confirm("تأكيد الحذف؟")) return;
    const { error } = await supabase.from(table).delete().eq("id", rid);
    if (error) toast.error(error.message); else refresh();
  };
  const deleteSubject = async () => {
    if (!confirm("حذف المادة بالكامل؟ ستبقى المصادر والامتحانات في السجل.")) return;
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["subjects"] });
    navigate({ to: "/notebooks" });
  };

  const SourceList = ({ list }: { list: typeof sources }) => (
    <ul className="space-y-1">
      {list.map((s) => (
        <li key={s.id} className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="w-3.5 h-3.5" /><span className="truncate flex-1">{s.title}</span>
          <button onClick={() => remove("sources", s.id)} aria-label="حذف المصدر"><Trash2 className="w-3.5 h-3.5 hover:text-destructive" /></button>
        </li>
      ))}
    </ul>
  );

  const Actions = ({ sc, table }: { sc: Scope; table: "subjects" | "subject_units" | "subject_lessons" }) => (
    <div className="flex gap-1 flex-wrap">
      <Button size="sm" variant="ghost" onClick={() => setRename({ table, id: sc.id, name: sc.name })} aria-label="إعادة تسمية"><Pencil className="w-4 h-4" /></Button>
      <Button size="sm" variant="outline" onClick={() => setAddSrc(sc)}><Upload className="w-4 h-4 ms-1" />مصدر</Button>
      <Button size="sm" onClick={() => setExamScope(sc)} disabled={!sourcesFor(sc).length}><Play className="w-4 h-4 ms-1" />اختبار</Button>
    </div>
  );

  const subjectScope: Scope = { level: "subject", id, name: subject.name };
  const directSubjectSources = sources.filter((s) => !s.unit_id && !s.lesson_id);

  return (
    <div className="space-y-6">
      <Link to="/notebooks" className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowRight className="w-4 h-4" />كل المواد</Link>

      <Card className="p-5 flex flex-wrap items-center gap-4">
        <BookIcon color={subject.color} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{subject.name}</h1>
          <div className="text-sm text-muted-foreground">{sources.length} مصدر · {exams.length} امتحان ·{" "}
            <span className={masteryColor(masteryFor(() => true))}>الإتقان {masteryFor(() => true) ?? "—"}{masteryFor(() => true) != null && "%"}</span>
          </div>
        </div>
        <Actions sc={subjectScope} table="subjects" />
        <Button size="sm" variant="ghost" onClick={deleteSubject} aria-label="حذف المادة"><Trash2 className="w-4 h-4 text-destructive" /></Button>
      </Card>

      {directSubjectSources.length > 0 && (
        <Card className="p-4"><div className="text-sm font-semibold mb-2">مراجع عامة للمادة</div><SourceList list={directSubjectSources} /></Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">الوحدات</h2>
        <Button size="sm" variant="outline" onClick={addUnit}><FolderPlus className="w-4 h-4 ms-1" />إضافة وحدة</Button>
      </div>

      {units.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد وحدات — أضف وحدة وسمّها باسمها الفعلي.</Card>}

      {units.map((u) => {
        const us: Scope = { level: "unit", id: u.id, name: u.name };
        const uLessons = lessons.filter((l) => l.unit_id === u.id);
        const m = masteryFor((e) => e.unit_id === u.id);
        return (
          <Card key={u.id} className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-bold">{u.name}</div>
                <div className="text-xs text-muted-foreground">{sourcesFor(us).length} مصدر (شامل الدروس) · <span className={masteryColor(m)}>الإتقان {m ?? "—"}{m != null && "%"}</span></div>
              </div>
              <Actions sc={us} table="subject_units" />
              <Button size="sm" variant="ghost" onClick={() => remove("subject_units", u.id)} aria-label="حذف الوحدة"><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
            <SourceList list={sources.filter((s) => s.unit_id === u.id && !s.lesson_id)} />
            <div className="space-y-2 border-s-2 ps-3">
              {uLessons.map((l) => {
                const ls: Scope = { level: "lesson", id: l.id, name: l.name, unitId: u.id };
                const lm = masteryFor((e) => e.lesson_id === l.id);
                return (
                  <div key={l.id} className="rounded-lg bg-muted/40 p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{l.name}</div>
                        <div className="text-xs"><span className={masteryColor(lm)}>الإتقان {lm ?? "—"}{lm != null && "%"}</span></div>
                      </div>
                      <Actions sc={ls} table="subject_lessons" />
                      <Button size="sm" variant="ghost" onClick={() => remove("subject_lessons", l.id)} aria-label="حذف الدرس"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                    <SourceList list={sources.filter((s) => s.lesson_id === l.id)} />
                  </div>
                );
              })}
              <Button size="sm" variant="ghost" onClick={() => addLesson(u.id)}><Plus className="w-4 h-4 ms-1" />إضافة درس / محاضرة</Button>
            </div>
          </Card>
        );
      })}

      {exams.length > 0 && (
        <Card className="p-4">
          <h2 className="font-bold mb-2">امتحانات المادة</h2>
          <ul className="space-y-1 text-sm">
            {exams.slice(0, 15).map((e) => (
              <li key={e.id} className="flex justify-between">
                <Link to="/exams/$id" params={{ id: e.id }} className="hover:underline truncate">{e.title}</Link>
                <span className={masteryColor(e.score == null ? null : Number(e.score))}>{e.score == null ? "—" : `${Math.round(Number(e.score))}%`}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <RenameDialog value={rename} onClose={() => setRename(null)} onDone={refresh} />
      <AddSourceDialog scope={addSrc} subjectId={id} onClose={() => setAddSrc(null)} onDone={refresh} />
      <ExamDialog scope={examScope} onClose={() => setExamScope(null)}
        onStart={async (opts) => {
          const sc = examScope!;
          const ids = sourcesFor(sc).map((s) => s.id);
          const res = await generate({
            data: {
              sourceId: ids[0], extraSourceIds: ids.slice(1, 40),
              title: opts.title || `اختبار: ${sc.name}`,
              durationMinutes: opts.duration, questionCount: opts.count,
              difficulty: "mixed", questionType: opts.qType, questionShape: "mixed",
              cognitiveProfile: "analytical", isRetraining: false,
              subjectId: id,
              unitId: sc.level === "unit" ? sc.id : sc.unitId,
              lessonId: sc.level === "lesson" ? sc.id : undefined,
            },
          });
          toast.success(`تم توليد ${res.questionCount} سؤال`);
          navigate({ to: "/exams/$id", params: { id: res.examId } });
        }} />
    </div>
  );
}

function RenameDialog({ value, onClose, onDone }: { value: { table: "subjects" | "subject_units" | "subject_lessons"; id: string; name: string } | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const open = !!value;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else setName(value?.name ?? ""); }}>
      <DialogContent onOpenAutoFocus={() => setName(value?.name ?? "")}>
        <DialogHeader><DialogTitle>إعادة التسمية</DialogTitle></DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <DialogFooter>
          <Button onClick={async () => {
            if (!value || !name.trim()) return;
            const { error } = await supabase.from(value.table).update({ name: name.trim() }).eq("id", value.id);
            if (error) return toast.error(error.message);
            onDone(); onClose();
          }}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddSourceDialog({ scope, subjectId, onClose, onDone }: { scope: Scope | null; subjectId: string; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const onFile = async (f: File) => {
    setBusy(true);
    try {
      const r = await extractDocumentAssets(f);
      setText(r.text);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    } catch (e: any) { toast.error(e.message || "تعذّر قراءة الملف"); }
    setBusy(false);
  };
  const save = async () => {
    if (!scope || text.trim().length < 50) return toast.error("المحتوى قصير جدًا");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("sources").insert({
      user_id: u.user!.id, title: title.trim() || "مصدر", content: text, char_count: text.length,
      subject_id: subjectId,
      unit_id: scope.level === "unit" ? scope.id : scope.unitId ?? null,
      lesson_id: scope.level === "lesson" ? scope.id : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTitle(""); setText(""); onDone(); onClose();
  };
  return (
    <Dialog open={!!scope} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة مصدر إلى: {scope?.name}</DialogTitle></DialogHeader>
        <Input placeholder="عنوان المصدر" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="file" accept=".pdf,.docx,.txt,image/*" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <Textarea rows={6} placeholder="أو الصق النص هنا" value={text} onChange={(e) => setText(e.target.value)} />
        <DialogFooter><Button onClick={save} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin ms-1" />}حفظ المصدر</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExamDialog({ scope, onClose, onStart }: { scope: Scope | null; onClose: () => void; onStart: (o: { title: string; count: number; duration: number; qType: "mcq" | "essay" | "mixed" }) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(10);
  const [duration, setDuration] = useState(20);
  const [qType, setQType] = useState<"mcq" | "essay" | "mixed">("mixed");
  const [busy, setBusy] = useState(false);
  const label = scope?.level === "subject" ? "امتحان شامل للمادة" : scope?.level === "unit" ? "امتحان الوحدة كاملة (مع دروسها)" : "امتحان الدرس";
  return (
    <Dialog open={!!scope} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{label}: {scope?.name}</DialogTitle></DialogHeader>
        <Input placeholder="عنوان الامتحان (اختياري)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <div><Label>عدد الأسئلة</Label><Input type="number" min={1} max={30} value={count} onChange={(e) => setCount(Math.min(30, Math.max(1, +e.target.value)))} /></div>
          <div><Label>المدة (دقيقة)</Label><Input type="number" min={1} max={300} value={duration} onChange={(e) => setDuration(Math.min(300, Math.max(1, +e.target.value)))} /></div>
        </div>
        <div className="flex gap-2">
          {(["mixed", "mcq", "essay"] as const).map((t) => (
            <Button key={t} size="sm" variant={qType === t ? "default" : "outline"} onClick={() => setQType(t)}>
              {t === "mixed" ? "مختلط" : t === "mcq" ? "اختيار من متعدد" : "مقالي"}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button disabled={busy} onClick={async () => {
            setBusy(true);
            try { await onStart({ title, count, duration, qType }); onClose(); }
            catch (e: any) { toast.error(e.message || "فشل التوليد"); }
            setBusy(false);
          }}>{busy && <Loader2 className="w-4 h-4 animate-spin ms-1" />}{busy ? "جارٍ التوليد..." : "ابدأ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
