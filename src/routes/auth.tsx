import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookOpenCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "تسجيل الدخول — اختبرني" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message === "Invalid login credentials" ? "بيانات الدخول غير صحيحة" : error.message);
    toast.success("أهلاً بعودتك!");
    navigate({ to: "/dashboard", replace: true });
  };

  const signUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء حسابك بنجاح!");
    navigate({ to: "/dashboard", replace: true });
  };

  const signInGoogle = async () => {
    setLoading(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) { setLoading(false); return toast.error("فشل تسجيل الدخول بـ Google"); }
    if (res.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-md p-8" style={{ boxShadow: "var(--shadow-elevated)" }}>
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-primary-foreground mb-3" style={{ background: "var(--gradient-primary)" }}>
            <BookOpenCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">مرحبًا بك في اختبرني</h1>
          <p className="text-sm text-muted-foreground mt-1">امتحانات ذكية من مصدرك التعليمي</p>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">تسجيل دخول</TabsTrigger>
            <TabsTrigger value="signup">حساب جديد</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4 mt-5">
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
            </div>
            <Button onClick={signIn} disabled={loading || !email || !password} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "تسجيل الدخول"}
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4 mt-5">
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" minLength={6} />
              <p className="text-xs text-muted-foreground">٦ أحرف على الأقل</p>
            </div>
            <Button onClick={signUp} disabled={loading || !email || password.length < 6} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "إنشاء حساب"}
            </Button>
          </TabsContent>
        </Tabs>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">أو</span></div>
        </div>

        <Button variant="outline" onClick={signInGoogle} disabled={loading} className="w-full">
          <svg className="w-4 h-4 ml-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          المتابعة بـ Google
        </Button>
      </Card>
    </div>
  );
}
