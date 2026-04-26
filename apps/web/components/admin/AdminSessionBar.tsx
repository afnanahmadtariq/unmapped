"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

export default function AdminSessionBar() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiClient
      .authMe()
      .then((res) => {
        if (alive) setEmail(res.admin.email);
      })
      .catch(() => {
        if (alive) setEmail(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const logout = async () => {
    try {
      await apiClient.authLogout();
    } catch {
      /* ignore */
    } finally {
      router.replace("/admin/login");
    }
  };

  if (!email) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border-default bg-bg-raised px-4 py-2 text-xs">
      <div className="flex items-center gap-2 text-fg-secondary">
        <ShieldCheck className="h-3 w-3 text-accent" />
        <span>Signed in as <strong className="text-fg-primary">{email}</strong></span>
      </div>
      <button
        onClick={logout}
        className="inline-flex items-center gap-1 rounded-md border border-border-default bg-bg-base px-2 py-1 text-[11px] text-fg-secondary hover:border-danger/50 hover:text-danger"
      >
        <LogOut className="h-3 w-3" /> Sign out
      </button>
    </div>
  );
}
