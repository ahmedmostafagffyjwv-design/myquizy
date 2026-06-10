import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { BookOpenCheck, Sparkles, Brain, Target, FileText, Trophy, RefreshCw } from "lucide-react";
import ogImage from "@/assets/og-image.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "اختبرني — مولّد امتحانات ذكي من مصدرك" },
      { name: "description", content: "ارفع كتابك أو ملاحظاتك ودع الذكاء الاصطناعي يولّد لك امتحانات مخصصة مع تصحيح فوري وبنك أخطاء ذكي." },
      { property: "og:title", content: "اختبرني — مولّد امتحانات ذكي من مصدرك" },
      { property: "og:description", content: "امتحانات مخصصة من محتواك أنت، مع تصحيح فوري وبنك أخطاء ذكي." },
      { property: "og:image", content: ogImage },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: ogImage },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* nav */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
              <BookOpenCheck className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-xl">اختبرني</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost">تسجيل الدخول</Button></Link>
            <Link to="/auth"><Button>ابدأ مجانًا</Button></Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="px-4 py-20 md:py-28">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              مدعوم بالذكاء الاصطناعي
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 font-display leading-tight">
              امتحاناتك القادمة
              <br />
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
                مولّدة من مصدرك أنت
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              ارفع كتابك، ملاحظاتك، أو حتى صورة من المحاضرة، واحصل على امتحان مخصّص خلال ثوانٍ —
              مع تصحيح ذكي وبنك أخطاء يعيد تدريبك على نقاط ضعفك.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link to="/auth">
                <Button size="lg" className="text-base h-12 px-8" style={{ boxShadow: "var(--shadow-glow)" }}>
                  ابدأ امتحانك الأول
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* features */}
      <section className="px-4 py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">كل ما تحتاجه للمذاكرة الذكية</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: FileText, title: "من مصدرك فقط", desc: "كل سؤال مبني حرفيًا على المحتوى الذي رفعته. لا هلوسة، لا معلومات خارجية." },
              { icon: Brain, title: "أسئلة متنوعة", desc: "اختيار من متعدد، أسئلة مقالية، أو مزيج. اختر المستوى من السهل للصعب." },
              { icon: Target, title: "تصحيح فوري", desc: "الذكاء الاصطناعي يصحح إجاباتك المقالية ويقدم ملاحظات بناءة." },
              { icon: RefreshCw, title: "بنك الأخطاء", desc: "كل سؤال تخطئ فيه يُحفظ تلقائيًا، وتعيد التدريب عليه حتى تتقنه." },
              { icon: Trophy, title: "تتبع تقدمك", desc: "إحصائيات مفصلة عن أدائك وتحسنك عبر الوقت." },
              { icon: Sparkles, title: "تجربة عصرية", desc: "واجهة أنيقة، وضع ليلي، حركات ناعمة، وتجربة تشبه أفضل تطبيقات التعلم." },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="bg-card border rounded-2xl p-6"
                style={{ boxShadow: "var(--shadow-soft)" }}
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="px-4 py-20">
        <div className="max-w-3xl mx-auto text-center rounded-3xl p-10 md:p-14" style={{ background: "var(--gradient-primary)" }}>
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">جاهز لاختبار نفسك؟</h2>
          <p className="text-primary-foreground/90 mb-8 text-lg">ابدأ الآن — مجانًا، بدون بطاقة ائتمان.</p>
          <Link to="/auth">
            <Button size="lg" variant="secondary" className="h-12 px-8 text-base">إنشاء حساب</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        صُنع بـ ♥ لمساعدتك على التعلم بشكل أذكى
      </footer>
    </div>
  );
}
