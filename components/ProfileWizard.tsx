"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  FileJson,
  GraduationCap,
  Languages,
  Loader2,
  PencilLine,
  Sparkles,
  Wand2,
} from "lucide-react";
import clsx from "clsx";
import SkillChipInput from "@/components/SkillChipInput";
import ClarificationCard from "@/components/ClarificationCard";
import { useToast } from "@/components/Toast";
import { buildSkillsProfilePdf } from "@/lib/pdf";
import type {
  AgeRange,
  CountryCode,
  Gender,
  SkillsProfile,
  SkillEvidence,
  WorkMode,
} from "@/types";
import type { ClarifyingQuestion } from "@/lib/llm";
import type { Dictionary } from "@/lib/i18n";
import { fmt } from "@/lib/i18n";

interface Props {
  countryCode: CountryCode;
  countryName: string;
  locale: string;
  t: Dictionary;
  opportunitiesHref: string;
}

const EDUCATION_KEYS = [
  "none",
  "primary",
  "lowerSecondary",
  "upperSecondary",
  "vocational",
  "diploma",
  "bachelor",
  "postgrad",
] as const;

const AGE_KEYS: AgeRange[] = ["u18", "18_24", "25_29", "30_34", "35plus"];
const GENDER_KEYS: Gender[] = ["prefer", "woman", "man", "nonbinary", "self"];
const WORKMODE_KEYS: WorkMode[] = ["informal", "formal", "gig", "study", "looking"];

const LANGUAGE_SUGGESTIONS_BY_COUNTRY: Record<CountryCode, string[]> = {
  GH: ["English", "Twi", "Ga", "Ewe", "Hausa", "Dagbani"],
  BD: ["Bangla", "English", "Chittagonian", "Sylheti", "Hindi", "Urdu"],
};

const SKILL_SUGGESTIONS = [
  "Phone repair",
  "Soldering",
  "JavaScript",
  "Python",
  "Customer service",
  "Bookkeeping",
  "Tailoring",
  "Cooking",
  "Welding",
  "Driving",
  "Photography",
  "Childcare",
  "Hairdressing",
  "Crop cultivation",
  "Sales",
];

const SAMPLE_STORIES_BY_COUNTRY: Record<CountryCode, string> = {
  GH: "I run a phone repair business in Accra and have done since I was 17. I taught myself JavaScript from YouTube videos and built a small website for my cousin's clothing shop. I also help her keep the books and answer customers in English, Twi and Ga.",
  BD: "I work in a small electronics repair shop in Dhaka. I learned to fix laptops and routers on the job over four years. Recently I started using Python to automate inventory tracking for my employer. I sometimes help my sister sell hand-stitched garments online in Bangla and English.",
};

type Step = 0 | 1 | 2;

export default function ProfileWizard({
  countryCode,
  countryName,
  locale,
  t,
  opportunitiesHref,
}: Props) {
  const toast = useToast();
  const [step, setStep] = useState<Step>(0);

  const [educationKey, setEducationKey] = useState<typeof EDUCATION_KEYS[number]>("upperSecondary");
  const [years, setYears] = useState(3);
  const [ageRange, setAgeRange] = useState<AgeRange | undefined>(undefined);
  const [gender, setGender] = useState<Gender | undefined>(undefined);
  const [workMode, setWorkMode] = useState<WorkMode | undefined>(undefined);
  const [location, setLocation] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<SkillsProfile | null>(null);

  // Clarification round state.
  const [clarify, setClarify] = useState<{
    reason: string;
    questions: ClarifyingQuestion[];
  } | null>(null);
  const [conversation, setConversation] = useState<{
    history: unknown[];
    lastAssistant: unknown[];
    baseInput: unknown;
  } | null>(null);

  const langSuggestions = useMemo(
    () => LANGUAGE_SUGGESTIONS_BY_COUNTRY[countryCode] ?? [],
    [countryCode]
  );

  const STEPS = [
    { key: 0 as Step, label: t.profile.step1Title, icon: GraduationCap },
    { key: 1 as Step, label: t.profile.step2Title, icon: Languages },
    { key: 2 as Step, label: t.profile.step3Title, icon: PencilLine },
  ];

  const charCount = story.length;
  const storyValid = story.trim().length >= 20 && story.trim().length <= 1200;
  const stepValid: Record<Step, boolean> = {
    0: !!educationKey,
    1: true,
    2: storyValid,
  };

  const fillSample = () => {
    setStory(SAMPLE_STORIES_BY_COUNTRY[countryCode]);
    if (languages.length === 0) {
      setLanguages(countryCode === "GH" ? ["English", "Twi", "Ga"] : ["Bangla", "English"]);
    }
    if (skills.length === 0) {
      setSkills(["phone repair", "JavaScript", "customer service"]);
    }
    if (!ageRange) setAgeRange("18_24");
    if (!workMode) setWorkMode("informal");
    if (!location) setLocation(countryCode === "GH" ? "Accra" : "Dhaka");
    toast.push({
      tone: "info",
      title: t.profile.sampleLoadedTitle,
      body: t.profile.sampleLoadedBody,
    });
  };

  const handleProfile = (data: SkillsProfile) => {
    setProfile(data);
    setClarify(null);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        `unmapped:profile:${countryCode}`,
        JSON.stringify(data)
      );
    }
    toast.push({
      tone: "success",
      title: t.profile.successTitle,
      body: fmt(t.profile.successBody, { n: data.skills.length }),
    });
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    setProfile(null);
    setClarify(null);
    setConversation(null);
    try {
      const res = await fetch("/api/extract-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode,
          educationLevel: t.profile.education[educationKey],
          languages,
          yearsExperience: years,
          story,
          declaredSkills: skills,
          demographics: {
            ageRange,
            gender,
            location: location.trim() || undefined,
            workMode,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const baseInput = data.baseInput;
      const history = data.history;
      if (data.result?.kind === "clarify") {
        setClarify({ reason: data.result.reason, questions: data.result.questions });
        // Stash the assistant tool_use block (= last item in history) for the follow-up call.
        const lastAssistant = (history as Array<{ role: string; content: unknown[] }>).at(-1)?.content ?? [];
        setConversation({ history, lastAssistant, baseInput });
      } else if (data.result?.kind === "profile") {
        handleProfile(data.result.profile as SkillsProfile);
      } else {
        throw new Error("Unexpected response shape");
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "Unknown error";
      setError(m);
      toast.push({ tone: "error", title: t.profile.errorTitle, body: m });
    } finally {
      setLoading(false);
    }
  };

  const submitAnswers = async (answers: Record<string, string>) => {
    if (!conversation) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/extract-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "follow-up",
          history: conversation.history,
          lastAssistant: conversation.lastAssistant,
          answers,
          baseInput: conversation.baseInput,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.result?.kind === "clarify") {
        setClarify({ reason: data.result.reason, questions: data.result.questions });
      } else if (data.result?.kind === "profile") {
        handleProfile(data.result.profile as SkillsProfile);
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "Unknown error";
      setError(m);
      toast.push({ tone: "error", title: t.profile.errorTitle, body: m });
    } finally {
      setLoading(false);
    }
  };

  const next = () => setStep((s) => (Math.min(2, s + 1) as Step));
  const prev = () => setStep((s) => (Math.max(0, s - 1) as Step));

  const exportJSON = () => {
    if (!profile) return;
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    triggerDownload(blob, `unmapped-profile-${profile.countryCode}.json`);
    toast.push({ tone: "success", title: t.profile.jsonDownloaded });
  };

  const exportPDF = () => {
    if (!profile) return;
    const doc = buildSkillsProfilePdf({ profile, countryName, locale });
    doc.save(`unmapped-profile-${profile.countryCode}.pdf`);
    toast.push({ tone: "success", title: t.profile.pdfDownloaded });
  };

  if (profile) {
    return (
      <ProfileResult
        profile={profile}
        countryName={countryName}
        opportunitiesHref={opportunitiesHref}
        t={t}
        onReset={() => {
          setProfile(null);
          setClarify(null);
          setConversation(null);
          setStep(0);
        }}
        onExportJSON={exportJSON}
        onExportPDF={exportPDF}
      />
    );
  }

  if (clarify) {
    return (
      <div className="space-y-6">
        <ClarificationCard
          reason={clarify.reason}
          questions={clarify.questions}
          loading={loading}
          t={t}
          onSubmit={submitAnswers}
        />
        <button
          type="button"
          onClick={() => {
            setClarify(null);
            setConversation(null);
          }}
          className="text-xs text-fg-muted underline-offset-2 hover:text-fg-primary hover:underline"
        >
          {t.profile.editAgain}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-border-default bg-bg-raised p-6 shadow-sm">
        <Stepper step={step} steps={STEPS} />

        <div className="mt-7">
          {step === 0 && (
            <StepBody
              title={t.profile.step1Heading}
              hint={t.profile.step1Hint}
            >
              <Field label={t.profile.fieldEducation}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {EDUCATION_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEducationKey(key)}
                      className={clsx(
                        "rounded-lg border px-3 py-2.5 text-left text-sm transition",
                        key === educationKey
                          ? "border-accent bg-accent/10 text-fg-primary"
                          : "border-border-default bg-bg-base text-fg-secondary hover:border-border-strong hover:text-fg-primary"
                      )}
                    >
                      <span className="block font-medium">
                        {t.profile.education[key]}
                      </span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={t.profile.fieldYears}>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={years}
                    onChange={(e) => setYears(Number(e.target.value))}
                    className="flex-1 accent-accent"
                  />
                  <span className="w-16 rounded-md border border-border-default bg-bg-base px-2 py-1 text-center font-mono text-sm text-accent">
                    {fmt(t.profile.draftYearsValue, { n: years })}
                  </span>
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.profile.fieldAge}>
                  <ChipGroup
                    options={AGE_KEYS.map((k) => ({ key: k, label: t.profile.ageRanges[k] }))}
                    value={ageRange}
                    onChange={(v) => setAgeRange(v as AgeRange)}
                  />
                </Field>
                <Field label={t.profile.fieldGender}>
                  <ChipGroup
                    options={GENDER_KEYS.map((k) => ({ key: k, label: t.profile.gender[k] }))}
                    value={gender}
                    onChange={(v) => setGender(v as Gender)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.profile.fieldLocation}>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t.profile.locationPlaceholder}
                    className="w-full rounded-md border border-border-default bg-bg-base px-3 py-2 text-fg-primary transition focus:border-accent/60 focus:outline-hidden focus:ring-2 focus:ring-accent/20"
                  />
                </Field>
                <Field label={t.profile.fieldWorkMode}>
                  <ChipGroup
                    options={WORKMODE_KEYS.map((k) => ({ key: k, label: t.profile.workMode[k] }))}
                    value={workMode}
                    onChange={(v) => setWorkMode(v as WorkMode)}
                  />
                </Field>
              </div>
            </StepBody>
          )}

          {step === 1 && (
            <StepBody
              title={t.profile.step2Heading}
              hint={t.profile.step2Hint}
            >
              <Field label={t.profile.fieldLanguages}>
                <SkillChipInput
                  value={languages}
                  onChange={setLanguages}
                  suggestions={langSuggestions}
                  placeholder={t.profile.languagesPlaceholder}
                  ariaLabel={t.profile.fieldLanguages}
                />
              </Field>
              <Field label={t.profile.fieldSkills}>
                <SkillChipInput
                  value={skills}
                  onChange={setSkills}
                  suggestions={SKILL_SUGGESTIONS}
                  placeholder={t.profile.skillsPlaceholder}
                  ariaLabel={t.profile.fieldSkills}
                />
              </Field>
            </StepBody>
          )}

          {step === 2 && (
            <StepBody
              title={t.profile.step3Heading}
              hint={t.profile.step3Hint}
              actions={
                <button
                  type="button"
                  onClick={fillSample}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-[11px] text-fg-secondary hover:border-accent/40 hover:text-accent"
                >
                  <Wand2 className="h-3 w-3" /> {t.profile.trySample}
                </button>
              }
            >
              <Field
                label={t.profile.fieldStory}
                hint={`${charCount}/1200`}
                hintTone={charCount > 1200 ? "danger" : storyValid ? "ok" : "muted"}
              >
                <textarea
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  rows={6}
                  placeholder={SAMPLE_STORIES_BY_COUNTRY[countryCode].slice(0, 80) + "..."}
                  className="w-full rounded-md border border-border-default bg-bg-base px-3 py-2 text-fg-primary transition focus:border-accent/60 focus:outline-hidden focus:ring-2 focus:ring-accent/20"
                />
              </Field>
              {error && (
                <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {t.profile.errorTitle}: {error}
                </p>
              )}
            </StepBody>
          )}
        </div>

        <footer className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border-default pt-5">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0 || loading}
            className="inline-flex items-center gap-2 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-sm text-fg-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t.profile.back}
          </button>
          <p className="text-[11px] text-fg-muted">
            {fmt(t.profile.stepProgress, { current: step + 1, total: STEPS.length })}
          </p>
          {step < 2 ? (
            <button
              type="button"
              onClick={next}
              disabled={!stepValid[step]}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t.profile.continue} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={loading || !storyValid}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t.profile.submitLoading}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> {t.profile.submit}
                </>
              )}
            </button>
          )}
        </footer>
      </section>

      <aside className="rounded-2xl border border-border-default bg-bg-raised p-6 shadow-sm">
        <p className="text-[10px] uppercase tracking-widest text-fg-muted">
          {t.profile.draftEyebrow}
        </p>
        <h3 className="mt-1 text-base font-medium text-fg-primary">
          {t.profile.draftTitle}
        </h3>

        <dl className="mt-5 space-y-3 text-sm">
          <Row label={t.profile.draftCountry} value={countryName} />
          <Row label={t.profile.draftEducation} value={t.profile.education[educationKey]} />
          <Row
            label={t.profile.draftYears}
            value={fmt(t.profile.draftYearsValue, { n: years })}
          />
          <Row
            label={t.profile.draftAge}
            value={ageRange ? t.profile.ageRanges[ageRange] : "-"}
          />
          <Row
            label={t.profile.draftGender}
            value={gender ? t.profile.gender[gender] : "-"}
          />
          <Row label={t.profile.draftLocation} value={location || "-"} />
          <Row
            label={t.profile.draftWorkMode}
            value={workMode ? t.profile.workMode[workMode] : "-"}
          />
          <Row
            label={t.profile.draftLanguages}
            value={
              languages.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {languages.map((l) => (
                    <span key={l} className="rounded bg-bg-hover px-1.5 py-0.5 text-[11px] text-fg-secondary">
                      {l}
                    </span>
                  ))}
                </span>
              ) : (
                t.profile.draftLanguagesEmpty
              )
            }
          />
          <Row
            label={t.profile.draftSkills}
            value={
              skills.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {skills.map((s) => (
                    <span key={s} className="rounded bg-bg-hover px-1.5 py-0.5 text-[11px] text-fg-secondary">
                      {s}
                    </span>
                  ))}
                </span>
              ) : (
                t.profile.draftSkillsEmpty
              )
            }
          />
          <Row
            label={t.profile.draftStory}
            value={
              story.trim().length === 0
                ? t.profile.draftStoryEmpty
                : fmt(t.profile.draftStoryChars, { n: story.trim().length })
            }
          />
        </dl>

        {loading && (
          <div className="mt-6 space-y-2">
            <div className="skeleton h-4 rounded" />
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-4 w-5/6 rounded" />
          </div>
        )}
      </aside>
    </div>
  );
}

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: string; label: string }>;
  value: string | undefined;
  onChange: (k: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={clsx(
            "rounded-full border px-3 py-1 text-xs transition",
            value === o.key
              ? "border-accent bg-accent/10 text-accent"
              : "border-border-default bg-bg-base text-fg-secondary hover:border-border-strong hover:text-fg-primary"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({
  step,
  steps,
}: {
  step: Step;
  steps: Array<{ key: Step; label: string; icon: React.ComponentType<{ className?: string }> }>;
}) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const status: "done" | "active" | "pending" =
          i < step ? "done" : i === step ? "active" : "pending";
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={clsx(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xs font-medium transition",
                status === "done" && "border-positive/40 bg-positive/10 text-positive",
                status === "active" && "border-accent bg-accent/10 text-accent",
                status === "pending" && "border-border-default bg-bg-base text-fg-muted"
              )}
            >
              {status === "done" ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </span>
            <span
              className={clsx(
                "hidden text-xs sm:inline",
                status === "active" ? "font-medium text-fg-primary" : "text-fg-muted"
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span
                className={clsx(
                  "h-px flex-1 transition",
                  i < step ? "bg-positive/50" : "bg-border-default"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepBody({
  title,
  hint,
  actions,
  children,
}: {
  title: string;
  hint?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-[slideUp_220ms_ease-out] space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-fg-primary">{title}</h3>
          {hint && <p className="mt-1 text-xs text-fg-muted">{hint}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  hintTone = "muted",
  children,
}: {
  label: string;
  hint?: string;
  hintTone?: "muted" | "ok" | "danger";
  children: React.ReactNode;
}) {
  const hintColor =
    hintTone === "ok" ? "text-positive" : hintTone === "danger" ? "text-danger" : "text-fg-muted";
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-widest text-fg-muted">
          {label}
        </span>
        {hint && <span className={`font-mono text-[10px] ${hintColor}`}>{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border-default pb-2 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-[10px] uppercase tracking-widest text-fg-muted">{label}</dt>
      <dd className="text-sm text-fg-primary">{value}</dd>
    </div>
  );
}

function ProfileResult({
  profile,
  countryName,
  opportunitiesHref,
  t,
  onReset,
  onExportJSON,
  onExportPDF,
}: {
  profile: SkillsProfile;
  countryName: string;
  opportunitiesHref: string;
  t: Dictionary;
  onReset: () => void;
  onExportJSON: () => void;
  onExportPDF: () => void;
}) {
  return (
    <div className="space-y-4 animate-[slideUp_220ms_ease-out]">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-default bg-bg-raised p-4 shadow-sm">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-fg-muted">
            {fmt(t.profile.resultEyebrow, { country: countryName })}
          </p>
          <p className="mt-1 text-fg-primary">
            {fmt(t.profile.resultSummary, { n: profile.skills.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-hover"
          >
            {t.profile.editAgain}
          </button>
          <button
            onClick={onExportJSON}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-hover"
          >
            <FileJson className="h-3.5 w-3.5" /> {t.profile.exportJson}
          </button>
          <button
            onClick={onExportPDF}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-hover"
          >
            <Download className="h-3.5 w-3.5" /> {t.profile.exportPdf}
          </button>
          <Link
            href={opportunitiesHref}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-strong"
          >
            {t.profile.openOpportunities} <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {profile.skills.map((s, i) => (
          <SkillCard key={s.escoCode + s.name} skill={s} index={i} t={t} />
        ))}
      </div>
    </div>
  );
}

function SkillCard({ skill, index, t }: { skill: SkillEvidence; index: number; t: Dictionary }) {
  return (
    <article
      className="rounded-xl border border-border-default bg-bg-raised p-4 transition hover:border-border-strong hover:shadow-sm"
      style={{
        animation: `slideUp 320ms ease-out`,
        animationDelay: `${index * 40}ms`,
        animationFillMode: "both",
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-fg-primary">{skill.name}</h3>
        <span className="rounded bg-bg-hover px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
          {skill.escoCode}
        </span>
      </header>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">
        {skill.level}
      </p>
      <details className="mt-3 cursor-pointer text-sm text-fg-secondary">
        <summary className="list-none text-accent hover:text-accent-strong [&::-webkit-details-marker]:hidden">
          {t.profile.whyThisSkill}
        </summary>
        <p className="mt-2 text-fg-secondary">{skill.evidence}</p>
        {skill.durabilityNote && (
          <p className="mt-2 rounded border border-border-default bg-bg-base px-2 py-1.5 text-xs text-fg-muted">
            {skill.durabilityNote}
          </p>
        )}
      </details>
    </article>
  );
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
