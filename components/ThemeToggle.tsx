"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

const STORAGE_KEY = "unmapped-theme";

function readPersistedTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // Default LIGHT unless OS explicitly prefers dark
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.style.colorScheme = t;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = readPersistedTheme();
    setTheme(t);
    applyTheme(t);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="grid h-9 w-9 place-items-center rounded-lg border border-border-default bg-bg-raised text-fg-secondary transition hover:border-border-strong hover:bg-bg-hover hover:text-fg-primary"
    >
      {mounted ? (
        theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4 opacity-0" />
      )}
    </button>
  );
}

/** No-flash inline script. Runs synchronously before React hydrates. */
export const ThemeNoFlashScript = () => {
  // Prevent React from warning about script tag in client components
  // by only rendering this raw script on the server.
  if (typeof window !== "undefined") {
    return null;
  }

  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var k='${STORAGE_KEY}';var s=localStorage.getItem(k);var t=(s==='light'||s==='dark')?s:(matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var h=document.documentElement;h.setAttribute('data-theme',t);h.style.colorScheme=t;}catch(e){}})();`,
      }}
    />
  );
};
