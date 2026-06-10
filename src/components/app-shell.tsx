import { Link, useRouter } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, PlusCircle, History, AlertTriangle, BarChart3, Sun, Moon, LogOut, BookOpenCheck, Info,
} from "lucide-react";
import type { ReactNode } from "react";

const navItems = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/exams/new", label: "امتحان جديد", icon: PlusCircle },
  { to: "/exams/history", label: "سجل الامتحانات", icon: History },
  { to: "/weak-bank", label: "بنك الأخطاء", icon: AlertTriangle },
  { to: "/stats", label: "الإحصائيات", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-l border-sidebar-border bg-sidebar">
        <div className="px-6 py-5 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
            <BookOpenCheck className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-lg">اختبرني</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <Link to="/about" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            <Info className="w-4 h-4" />
            عن المشروع
          </Link>
          <button onClick={toggle} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-sidebar-accent">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === "dark" ? "وضع نهاري" : "وضع ليلي"}
          </button>
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10">
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
              <BookOpenCheck className="w-4 h-4" />
            </div>
            <span className="font-bold">اختبرني</span>
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle}>
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-auto">{children}</main>
        {/* mobile bottom nav */}
        <nav className="md:hidden grid grid-cols-5 border-t bg-card">
          {navItems.map((it) => (
            <Link key={it.to} to={it.to} className="flex flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground" activeProps={{ className: "text-primary" }}>
              <it.icon className="w-5 h-5" />
              {it.label.split(" ")[0]}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
