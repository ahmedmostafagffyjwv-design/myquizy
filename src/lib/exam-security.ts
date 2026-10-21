// Exam integrity / anti-cheat session (Module: examEngine.startSecureSession)
// Installs protections while an exam is active and restores everything on submit/cleanup.
import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type IntegrityEventType =
  | "CONTEXT_MENU"
  | "DEVTOOLS_SHORTCUT"
  | "VIEW_SOURCE"
  | "SAVE_PAGE"
  | "PRINT_PAGE"
  | "REFRESH_ATTEMPT"
  | "COPY_ATTEMPT"
  | "DEVTOOLS_DETECTED"
  | "FOCUS_LOST";

export type SecureSessionOptions = {
  disableDevTools?: boolean;
  disableViewSource?: boolean;
  disableRefresh?: boolean;
  disableCopyPaste?: boolean;
  logAttempts?: boolean;
  restoreOnSubmit?: boolean;
};

const DEFAULTS: Required<SecureSessionOptions> = {
  disableDevTools: true,
  disableViewSource: true,
  disableRefresh: true,
  disableCopyPaste: true,
  logAttempts: true,
  restoreOnSubmit: true,
};

function isEditable(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}

/**
 * While `active` is true, blocks right-click, DevTools/view-source/save/print
 * shortcuts, refresh, and copy outside answer fields — logging every attempt
 * to the integrity_events table. Cleanup (submit / unmount) restores all.
 */
export function useSecureExamSession(examId: string | undefined, active: boolean, options: SecureSessionOptions = {}) {
  const opts = { ...DEFAULTS, ...options };
  const lastLogged = useRef<Record<string, number>>({});
  const devtoolsOpen = useRef(false);

  const logEvent = useCallback(
    (type: IntegrityEventType, keyPressed?: string) => {
      const now = Date.now();
      if (now - (lastLogged.current[type] ?? 0) < 5000) return; // throttle spam
      lastLogged.current[type] = now;
      if (!opts.logAttempts || !examId) return;
      void supabase
        .from("integrity_events")
        .insert({ exam_id: examId, attempt_type: type, key_pressed: keyPressed ?? null })
        .then(() => {}, () => {});
    },
    [examId, opts.logAttempts],
  );

  useEffect(() => {
    if (!active || !examId) return;

    const warn = () => toast.warning("⚠️ هذا الإجراء غير مسموح أثناء الاختبار — تم تسجيل المحاولة", { duration: 2500 });
    const block = (type: IntegrityEventType, key?: string) => {
      warn();
      logEvent(type, key);
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const code = e.code;
      const mod = e.ctrlKey || e.metaKey;

      // DevTools (F12 / Ctrl+Shift+I,J,C) — layout-independent via e.code
      if (opts.disableDevTools) {
        if (code === "F12") { e.preventDefault(); block("DEVTOOLS_SHORTCUT", key); return; }
        if (mod && e.shiftKey && ["KeyI", "KeyJ", "KeyC"].includes(code)) { e.preventDefault(); block("DEVTOOLS_SHORTCUT", key); return; }
      }
      // View source: Ctrl/Cmd+U
      if (opts.disableViewSource && mod && code === "KeyU") { e.preventDefault(); block("VIEW_SOURCE", key); return; }
      // Save page: Ctrl/Cmd+S
      if (mod && code === "KeyS") { e.preventDefault(); block("SAVE_PAGE", key); return; }
      // Print: Ctrl/Cmd+P
      if (mod && code === "KeyP") { e.preventDefault(); block("PRINT_PAGE", key); return; }
      // Refresh: F5 or Ctrl/Cmd+R
      if (opts.disableRefresh && (code === "F5" || (mod && (code === "KeyR" || key === "F5")))) { e.preventDefault(); block("REFRESH_ATTEMPT", key); return; }
      // Copy outside answer fields
      if (opts.disableCopyPaste && mod && (code === "KeyC" || code === "KeyX") && !isEditable(e.target)) { e.preventDefault(); block("COPY_ATTEMPT", key); return; }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (isEditable(e.target)) return; // allow paste menu inside answer fields
      e.preventDefault();
      block("CONTEXT_MENU");
    };

    const onCopy = (e: ClipboardEvent) => {
      if (!opts.disableCopyPaste || isEditable(e.target)) return;
      e.preventDefault();
      block("COPY_ATTEMPT");
    };

    const onFocusLost = () => logEvent("FOCUS_LOST");

    const onVisibility = () => {
      if (document.hidden) logEvent("FOCUS_LOST");
    };

    const detectDevtools = () => {
      const open =
        window.outerWidth - window.innerWidth > 200 ||
        window.outerHeight - window.innerHeight > 200;
      if (open && !devtoolsOpen.current) {
        devtoolsOpen.current = true;
        warn();
        logEvent("DEVTOOLS_DETECTED");
      } else if (!open) {
        devtoolsOpen.current = false;
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    window.addEventListener("blur", onFocusLost);
    document.addEventListener("visibilitychange", onVisibility);
    const devtoolsTimer = opts.disableDevTools ? setInterval(detectDevtools, 1500) : undefined;

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      window.removeEventListener("blur", onFocusLost);
      document.removeEventListener("visibilitychange", onVisibility);
      if (devtoolsTimer) clearInterval(devtoolsTimer);
    };
  }, [active, examId, logEvent, opts]);
}
