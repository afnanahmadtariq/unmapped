"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, X } from "lucide-react";
import clsx from "clsx";
import { useToast } from "@/components/Toast";
import type { Dictionary } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
  countryName: string;
  skillCount: number;
  t: Dictionary;
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailLinkModal({ open, onClose, url, countryName, skillCount, t }: Props) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const valid = EMAIL_RX.test(email.trim());

  const openMailto = () => {
    const subject = encodeURIComponent(`Your UNMAPPED skills profile - ${countryName}`);
    const body = encodeURIComponent(
      [
        "Open this link to restore your portable skills profile on any device.",
        "",
        url,
        "",
        `${skillCount} ESCO-grounded skills mapped for ${countryName}.`,
      ].join("\n")
    );
    window.location.href = `mailto:${encodeURIComponent(email.trim())}?subject=${subject}&body=${body}`;
    onClose();
  };

  const submit = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      const res = await fetch("/api/email-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), url, countryName, skillCount }),
      });
      const data = await res.json();
      if (data.sent) {
        toast.push({ tone: "success", title: t.profile.emailSentTitle, body: t.profile.emailSentBody });
        onClose();
      } else if (data.provider === "none") {
        // Resend not configured: open the user's mail client pre-filled
        toast.push({
          tone: "info",
          title: t.profile.emailFallbackTitle,
          body: t.profile.emailFallbackBody,
        });
        openMailto();
      } else {
        toast.push({
          tone: "error",
          title: t.profile.emailFailedTitle,
          body: data.error ?? "Unknown error",
        });
      }
    } catch (err) {
      toast.push({
        tone: "error",
        title: t.profile.emailFailedTitle,
        body: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border-default bg-bg-raised p-6 shadow-xl animate-[slideUp_180ms_ease-out]">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-white">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-fg-primary">
                {t.profile.emailModalTitle}
              </h3>
              <p className="text-xs text-fg-muted">{t.profile.emailModalHint}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <label className="mt-5 block">
          <span className="mb-1 block text-[10px] uppercase tracking-widest text-fg-muted">
            {t.profile.emailLabel}
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
            className="w-full rounded-md border border-border-default bg-bg-base px-3 py-2 text-sm text-fg-primary focus:border-accent/60 focus:outline-hidden focus:ring-2 focus:ring-accent/20"
          />
        </label>

        <p className="mt-3 text-[11px] text-fg-muted">{t.profile.emailPrivacyNote}</p>

        <footer className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border-default bg-bg-base px-3 py-2 text-xs text-fg-secondary hover:bg-bg-hover"
          >
            {t.profile.emailCancel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || loading}
            className={clsx(
              "inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong",
              (!valid || loading) && "cursor-not-allowed opacity-40"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {t.profile.emailSending}
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" /> {t.profile.emailSend}
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
