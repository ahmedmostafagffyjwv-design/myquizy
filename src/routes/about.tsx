import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, GraduationCap, Target, Heart, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "عن المشروع — اختبرني" },
      { name: "description", content: "اختبرني منصة ذكية طوّرها أحمد مصطفى، طالب بكلية التربية جامعة عين شمس، لمساعدة الطلاب على المراجعة الفعّالة عبر اختبارات تفاعلية وتتبّع الأخطاء." },
      { property: "og:title", content: "عن مشروع اختبرني" },
      { property: "og:description", content: "فكرة طوّرها أحمد مصطفى لمساعدة الطلاب على التعلم الفعّال عبر اختبارات تفاعلية وبنك أخطاء ذكي." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
              <BookOpenCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl">اختبرني</span>
          </Link>
          <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 ml-1" /> العودة</Button></Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 md:py-20 space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
            <Heart className="w-3.5 h-3.5" /> فكرة طالب لطلاب
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">عن المشروع</h1>
          <p className="text-muted-foreground text-lg">رحلة لتسهيل المراجعة وتحويلها إلى تجربة تعلّم ذكية</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-8 leading-loose text-lg">
            تم تطوير فكرة هذا المشروع بواسطة <span className="font-bold text-primary">أحمد مصطفى</span>،
            طالب بكلية التربية – جامعة عين شمس، بهدف إنشاء منصة ذكية تساعد الطلاب على التعلم الفعّال
            من خلال الاختبارات التفاعلية، وتتبّع الأخطاء، وتحسين عملية المراجعة.
          </Card>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: GraduationCap, title: "تعلّم فعّال", desc: "اختبارات مولّدة من محتواك أنت" },
            { icon: Target, title: "تتبّع الأخطاء", desc: "بنك ذكي يركّز على نقاط ضعفك" },
            { icon: Heart, title: "مجاني للطلاب", desc: "أداة بُنيت بحب لمجتمع التعلّم" },
          ].map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }}>
              <Card className="p-5 text-center h-full space-y-2">
                <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="text-center pt-4">
          <Link to="/auth"><Button size="lg">ابدأ المراجعة الآن</Button></Link>
        </div>
      </main>
    </div>
  );
}
