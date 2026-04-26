"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LogIn,
  LogOut,
  Sparkles,
  User as UserIcon,
  UserPlus,
} from "lucide-react";
import { useUserSession } from "@/lib/userSession";

interface Props {
  qs: string;
}

/**
 * Tiny header widget that renders one of three states:
 *   1. user-auth feature off                → renders nothing (graceful)
 *   2. user-auth on, visitor anonymous     → "Sign in" pill + "Sign up" CTA
 *   3. user-auth on, visitor signed in     → avatar + dropdown w/ /account + sign-out
 *
 * The hook polls /auth/user/status once on mount, so an unsigned env var
 * just means the entire widget hides itself — safe to leave in the
 * header for every page.
 */
export default function AccountMenu({ qs }: Props) {
  const router = useRouter();
  const { status, user, loading, signOut } = useUserSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (loading) {
    return (
      <div className="hidden h-8 w-20 animate-pulse rounded-md bg-bg-hover/60 md:block" />
    );
  }

  if (!status?.enabled) return null;

  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href={`/account/login${qs}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-raised px-3 py-1.5 text-xs font-medium text-fg-primary hover:bg-bg-hover"
        >
          <LogIn className="h-3.5 w-3.5" /> Sign in
        </Link>
        {status.signupEnabled && (
          <Link
            href={`/account/signup${qs}`}
            className="hidden items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-strong md:inline-flex"
          >
            <UserPlus className="h-3.5 w-3.5" /> Sign up
          </Link>
        )}
      </div>
    );
  }

  const initial = (user.displayName ?? user.email).slice(0, 1).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-border-default bg-bg-raised px-2.5 py-1.5 text-xs font-medium text-fg-primary hover:bg-bg-hover"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-[11px] font-semibold uppercase text-accent">
          {initial}
        </span>
        <span className="hidden max-w-[140px] truncate md:inline">
          {user.displayName ?? user.email}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-fg-muted" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 rounded-lg border border-border-default bg-bg-raised p-1.5 shadow-lg">
          <div className="rounded-md px-3 py-2 text-[11px] text-fg-muted">
            <div className="text-fg-primary">{user.displayName ?? "—"}</div>
            <div className="truncate">{user.email}</div>
          </div>
          <Link
            href={`/account${qs}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-fg-primary hover:bg-bg-hover"
          >
            <UserIcon className="h-3.5 w-3.5" />
            My account
          </Link>
          <Link
            href={`/profile${qs}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-fg-primary hover:bg-bg-hover"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Update profile
          </Link>
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await signOut();
              router.refresh();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-fg-primary hover:bg-bg-hover"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
