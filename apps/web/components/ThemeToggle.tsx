"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

const STORAGE_KEY = "cartographer-theme";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

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

function persistTheme(t: Theme) {
  window.localStorage.setItem(STORAGE_KEY, t);
  document.cookie = `${STORAGE_KEY}=${t}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = readPersistedTheme();
    setTheme(t);
    applyTheme(t);
    persistTheme(t);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    persistTheme(next);
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
