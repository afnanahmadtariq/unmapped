"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Award,
  Globe2,
  Loader2,
  LogOut,
  Pencil,
  RefreshCcw,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import Pill from "@/components/Pill";
import { useToast } from "@/components/Toast";
import {
  apiClient,
  ApiError,
  type CompetitionOverlap,
  type SavedUserProfile,
} from "@/lib/apiClient";
import { useUserSession } from "@/lib/userSession";
import { getCountry, DEFAULT_COUNTRY } from "@/lib/config";
import { getDictionary } from "@/lib/i18n";
import { buildProfileUrl } from "@/lib/profileUrl";
import type { SkillsProfile, MatchedOccupation, Opportunity } from "@/types";

interface RefreshState {
  loading: boolean;
  error: string | null;
}

function AccountInner() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const country = getCountry(searchParams?.get("country") ?? DEFAULT_COUNTRY);
  const locale = searchParams?.get("locale") ?? country.defaultLocale;
  const t = getDictionary(locale);
  const qs = `?country=${country.code}&locale=${locale}`;

  const { status, user, loading: sessionLoading, signOut } = useUserSession();

  const [profiles, setProfiles] = useState<SavedUserProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [competition, setCompetition] = useState<
    Record<string, CompetitionOverlap | null>
  >({});
  const [refreshing, setRefreshing] = useState<Record<string, RefreshState>>({});

  // Redirect anonymous visitors to /account/login.
  useEffect(() => {
    if (sessionLoading) return;
    if (!status?.enabled) return;
    if (!user) {
      router.replace(`/account/login${qs}&from=/account${qs}`);
    }
  }, [sessionLoading, status, user, router, qs]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoadingProfiles(true);
      try {
        const res = await apiClient.meListProfiles();
        if (cancelled) return;
        setProfiles(res.profiles);
        const overlaps: Record<string, CompetitionOverlap | null> = {};
        await Promise.all(
          res.profiles.map(async (p) => {
            try {
              overlaps[p.countryCode] = await apiClient.meCompetition(
                p.countryCode,
              );
            } catch {
              overlaps[p.countryCode] = null;
            }
          }),
        );
        if (cancelled) return;
        setCompetition(overlaps);
      } catch (err) {
        if (!cancelled) {
          toast.push({
            tone: "error",
            title: "Couldn't load saved profiles",
            body: err instanceof Error ? err.message : "Unknown error",
          });
        }
      } finally {
        if (!cancelled) setLoadingProfiles(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, toast]);

  const refreshInsights = async (profile: SavedUserProfile) => {
    setRefreshing((r) => ({
      ...r,
      [profile.countryCode]: { loading: true, error: null },
    }));
    try {
      const skills = profile.skillsProfile as unknown as SkillsProfile;
      const matchRes = await apiClient.matchOccupations({
        profile: skills,
        countryCode: profile.countryCode as SkillsProfile["countryCode"],
      });
      const top = matchRes.matches[0];
      let opportunities: Opportunity[] | null = null;
      if (top) {
        try {
          const opp = await apiClient.opportunityPathways({
            occupationTitle: top.title,
            iscoCode: top.iscoCode,
            countryCode: profile.countryCode as SkillsProfile["countryCode"],
            matchedSkills: top.matchedSkills,
          });
          opportunities = opp.opportunities;
        } catch {
          // best-effort
        }
      }
      let signals: unknown = null;
      try {
        signals = await apiClient.compositeSignals(
          profile.countryCode,
          top?.iscoCode ?? null,
          skills.skills.map((s) => s.escoCode),
        );
      } catch {
        // best-effort
      }
      const saved = await apiClient.meUpsertProfile({
        countryCode: profile.countryCode,
        extractInput: profile.extractInput,
        skillsProfile: profile.skillsProfile,
        matches: matchRes as unknown as Record<string, unknown>,
        opportunities: opportunities
          ? ({ opportunities } as unknown as Record<string, unknown>)
          : null,
        signals: signals as Record<string, unknown> | null,
        iscoCodes: matchRes.matches.map((m) => m.iscoCode),
      });
      setProfiles((prev) =>
        prev.map((p) =>
          p.countryCode === profile.countryCode ? saved.profile : p,
        ),
      );
      try {
        const overlap = await apiClient.meCompetition(profile.countryCode);
        setCompetition((c) => ({ ...c, [profile.countryCode]: overlap }));
      } catch {
        // best-effort
      }
      toast.push({
        tone: "success",
        title: "Insights refreshed",
        body: `Re-ran match + opportunities + composite signals for ${profile.countryCode}.`,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      setRefreshing((r) => ({
        ...r,
        [profile.countryCode]: { loading: false, error: msg },
      }));
      toast.push({ tone: "error", title: "Refresh failed", body: msg });
      return;
    }
    setRefreshing((r) => ({
      ...r,
      [profile.countryCode]: { loading: false, error: null },
    }));
  };

  const removeProfile = async (countryCode: string) => {
    if (!window.confirm(`Delete the saved profile for ${countryCode}?`)) return;
    try {
      await apiClient.meDeleteProfile(countryCode);
      setProfiles((prev) => prev.filter((p) => p.countryCode !== countryCode));
      toast.push({ tone: "success", title: `Deleted ${countryCode}` });
    } catch (err) {
      toast.push({
        tone: "error",
        title: "Delete failed",
        body: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const onSignOut = async () => {
    await signOut();
    router.replace(`/${qs}`);
  };

  if (sessionLoading || !user) {
    return (
      <main className="flex flex-1 flex-col">
        <SiteHeader
          countryCode={country.code}
          locale={locale}
          active="profile"
          t={t}
        />
        <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-6 py-16">
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading account…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader
        countryCode={country.code}
        locale={locale}
        active="profile"
        t={t}
      />
      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Pill tone="accent">
              <Sparkles className="h-3 w-3" /> My account
            </Pill>
            <h1 className="mt-3 text-3xl font-semibold text-fg-primary">
              {user.displayName ? `Hi, ${user.displayName}` : "Welcome back"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-fg-secondary">
              Your saved skills profiles, fresh insights, and how your
              occupations compare to other UNMAPPED visitors in the same
              country.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/profile${qs}`}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-strong"
            >
              <Pencil className="h-3.5 w-3.5" /> Update profile
            </Link>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-md border border-border-default bg-bg-raised px-4 py-2 text-xs text-fg-secondary hover:bg-bg-hover"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>

        {loadingProfiles ? (
          <div className="flex items-center gap-2 rounded-xl border border-border-default bg-bg-raised p-6 text-sm text-fg-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading saved profiles…
          </div>
        ) : profiles.length === 0 ? (
          <EmptyState qs={qs} />
        ) : (
          <div className="grid gap-4">
            {profiles.map((p) => (
              <SavedProfileCard
                key={p.id}
                profile={p}
                competition={competition[p.countryCode] ?? null}
                refreshing={refreshing[p.countryCode]?.loading ?? false}
                qs={qs}
                onRefresh={() => refreshInsights(p)}
                onDelete={() => removeProfile(p.countryCode)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function EmptyState({ qs }: { qs: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-default bg-bg-raised p-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-lg font-medium text-fg-primary">
        No saved profile yet
      </h2>
      <p className="mt-2 text-sm text-fg-muted">
        Run the wizard once and we&apos;ll save your skills profile here so you
        can come back to refreshed insights any time.
      </p>
      <Link
        href={`/profile${qs}`}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-strong"
      >
        Map my skills <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

interface CardProps {
  profile: SavedUserProfile;
  competition: CompetitionOverlap | null;
  refreshing: boolean;
  qs: string;
  onRefresh: () => void;
  onDelete: () => void;
}

function SavedProfileCard({
  profile,
  competition,
  refreshing,
  qs,
  onRefresh,
  onDelete,
}: CardProps) {
  const skills = profile.skillsProfile as unknown as SkillsProfile;
  const matches = useMemo(() => {
    const raw = profile.matches as unknown as
      | { matches?: MatchedOccupation[] }
      | null;
    return raw?.matches ?? [];
  }, [profile.matches]);
  const opportunities = useMemo(() => {
    const raw = profile.opportunities as unknown as
      | { opportunities?: Opportunity[] }
      | null;
    return raw?.opportunities ?? [];
  }, [profile.opportunities]);

  const portableUrl = useMemo(() => {
    if (!skills) return null;
    const sp = new URLSearchParams({
      country: profile.countryCode,
      locale: skills.languages?.[0] ?? "en",
    });
    return buildProfileUrl(skills, "/profile", sp);
  }, [skills, profile.countryCode]);

  const updated = new Date(profile.updatedAt).toLocaleString();
  const top = matches[0];

  return (
    <article className="rounded-2xl border border-border-default bg-bg-raised p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="accent">
              <Globe2 className="h-3 w-3" /> {profile.countryCode}
            </Pill>
            <Pill tone="neutral">{skills.skills?.length ?? 0} skills</Pill>
            <Pill tone="neutral">{matches.length} occupation matches</Pill>
            {opportunities.length > 0 && (
              <Pill tone="neutral">
                {opportunities.length} opportunity pathways
              </Pill>
            )}
          </div>
          <h2 className="mt-3 text-xl font-semibold text-fg-primary">
            {top
              ? `Top match — ${top.title}`
              : `Saved profile (${profile.countryCode})`}
          </h2>
          <p className="mt-1 text-xs text-fg-muted">Last updated {updated}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            Refresh insights
          </button>
          {portableUrl && (
            <Link
              href={portableUrl}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-xs text-fg-primary hover:bg-bg-hover"
            >
              <Pencil className="h-3.5 w-3.5" /> Open in wizard
            </Link>
          )}
          <Link
            href={`/opportunities${qs}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-xs text-fg-primary hover:bg-bg-hover"
          >
            <ArrowUpRight className="h-3.5 w-3.5" /> Opportunities
          </Link>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-xs text-fg-muted hover:border-danger/40 hover:bg-danger/5 hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border-default bg-bg-base p-4">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-fg-muted">
            <Award className="h-3 w-3" /> Top occupations
          </p>
          {matches.length === 0 ? (
            <p className="mt-3 text-xs text-fg-muted">
              No matches stored yet. Refresh to recompute.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {matches.slice(0, 5).map((m) => (
                <li
                  key={m.iscoCode}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-medium text-fg-primary">{m.title}</p>
                    <p className="text-fg-muted">ISCO {m.iscoCode}</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-border-default bg-bg-raised px-2 py-1 font-mono text-[10px]">
                    {(m.fitScore * 100).toFixed(0)}% fit
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border-default bg-bg-base p-4">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-fg-muted">
            <Users className="h-3 w-3" /> Competition in {profile.countryCode}
          </p>
          {!competition || competition.total === 0 ? (
            <p className="mt-3 text-xs text-fg-muted">
              No other UNMAPPED users in your country yet — you&apos;re
              setting the baseline.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm text-fg-primary">
                <span className="text-2xl font-semibold text-accent">
                  {competition.overlap}
                </span>{" "}
                <span className="text-fg-muted">
                  of {competition.total} other users
                </span>
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                share at least one occupation with you.
              </p>
              {competition.sharedCodes.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {competition.sharedCodes.slice(0, 5).map((c) => (
                    <li
                      key={c.iscoCode}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <span className="font-mono text-fg-muted">
                        ISCO {c.iscoCode}
                      </span>
                      <span className="rounded-md bg-bg-raised px-2 py-0.5 text-fg-primary">
                        {c.count}{" "}
                        {c.count === 1 ? "competitor" : "competitors"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-border-default bg-bg-base p-4">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-fg-muted">
            <Sparkles className="h-3 w-3" /> Opportunity pathways
          </p>
          {opportunities.length === 0 ? (
            <p className="mt-3 text-xs text-fg-muted">
              Refresh insights to generate adjacent-skill pathways for your top
              occupation.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {opportunities.slice(0, 4).map((o, idx) => (
                <li key={o.id ?? `${idx}`} className="text-xs">
                  <p className="font-medium text-fg-primary">
                    {o.title || "Pathway"}
                  </p>
                  {o.description && (
                    <p className="mt-0.5 line-clamp-2 text-fg-muted">
                      {o.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountInner />
    </Suspense>
  );
}
