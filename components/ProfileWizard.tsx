"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
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
  Sparkles,
  Wand2,
  PencilLine,
} from "lucide-react";
import clsx from "clsx";
import SkillChipInput from "@/components/SkillChipInput";
import { useToast } from "@/components/Toast";
import type { CountryCode, SkillsProfile, SkillEvidence } from "@/types";

interface Props {
  countryCode: CountryCode;
  countryName: string;
  locale: string;
  labels: {
    title: string;
    education: string;
    languages: string;
    years: string;
    story: string;
    skills: string;
    submit: string;
  };
  opportunitiesHref: string;
}

const EDUCATION_LEVELS = [
  "No formal schooling",
  "Primary",
  "Lower secondary (BECE / JSC)",
  "Upper secondary (WASSCE / SSC / HSC)",
  "Vocational / TVET certificate",
  "Diploma",
  "Bachelor's degree",
  "Postgraduate",
];

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

const STEPS: Array<{ key: Step; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 0, label: "About you", icon: GraduationCap },
  { key: 1, label: "Languages and skills", icon: Languages },
  { key: 2, label: "Your story", icon: PencilLine },
];

export default function ProfileWizard({
  countryCode,
  countryName,
  locale,
  labels,
  opportunitiesHref,
}: Props) {
  const toast = useToast();
  const [step, setStep] = useState<Step>(0);
  const [education, setEducation] = useState(EDUCATION_LEVELS[3]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [years, setYears] = useState(3);
  const [skills, setSkills] = useState<string[]>([]);
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<SkillsProfile | null>(null);

  const langSuggestions = useMemo(
    () => LANGUAGE_SUGGESTIONS_BY_COUNTRY[countryCode] ?? [],
    [countryCode]
  );

  const charCount = story.length;
  const storyValid = story.trim().length >= 20 && story.trim().length <= 1200;
  const stepValid: Record<Step, boolean> = {
    0: !!education,
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
    toast.push({ tone: "info", title: "Sample loaded", body: "You can edit any field before submitting." });
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    setProfile(null);
    try {
      const res = await fetch("/api/extract-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode,
          educationLevel: education,
          languages,
          yearsExperience: years,
          story,
          declaredSkills: skills,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SkillsProfile;
      setProfile(data);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          `unmapped:profile:${countryCode}`,
          JSON.stringify(data)
        );
      }
      toast.push({
        tone: "success",
        title: "Profile mapped",
        body: `${data.skills.length} ESCO-grounded skills extracted.`,
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : "Unknown error";
      setError(m);
      toast.push({ tone: "error", title: "Extraction failed", body: m });
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
    toast.push({ tone: "success", title: "JSON downloaded" });
  };

  const exportPDF = () => {
    if (!profile) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 56;
    doc.setFontSize(20);
    doc.text("UNMAPPED Skills Profile", 56, y);
    y += 24;
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(
      `Country: ${countryName} · Locale: ${locale} · Generated: ${new Date(profile.generatedAt).toLocaleString()}`,
      56,
      y
    );
    y += 24;
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text(`Education: ${profile.educationLevel}`, 56, y); y += 16;
    doc.text(`Languages: ${profile.languages.join(", ") || "-"}`, 56, y); y += 16;
    doc.text(`Years of experience: ${profile.yearsExperience}`, 56, y); y += 24;
    doc.setFontSize(13);
    doc.text("Mapped Skills (ESCO)", 56, y);
    y += 18;
    doc.setFontSize(10);
    profile.skills.forEach((s) => {
      if (y > 760) { doc.addPage(); y = 56; }
      doc.setTextColor(0);
      doc.text(`- ${s.name} [${s.escoCode}], ${s.level}`, 56, y);
      y += 14;
      doc.setTextColor(90);
      const lines = doc.splitTextToSize(`Evidence: ${s.evidence}`, W - 112);
      doc.text(lines, 72, y);
      y += lines.length * 12 + 8;
    });
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      "UNMAPPED, open skills infrastructure. Built on ESCO (EU) and ISCO-08 (ILO).",
      56,
      810
    );
    doc.save(`unmapped-profile-${profile.countryCode}.pdf`);
    toast.push({ tone: "success", title: "PDF downloaded" });
  };

  // After successful extraction, show the result view replacing the wizard.
  if (profile) {
    return (
      <ProfileResult
        profile={profile}
        countryName={countryName}
        opportunitiesHref={opportunitiesHref}
        onReset={() => {
          setProfile(null);
          setStep(0);
        }}
        onExportJSON={exportJSON}
        onExportPDF={exportPDF}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* WIZARD */}
      <section className="rounded-2xl border border-border-default bg-bg-raised p-6">
        <Stepper step={step} />

        <div className="mt-6">
          {step === 0 && (
            <StepBody
              title="Tell us about your education and experience"
              hint="This helps us calibrate skill levels and credential mapping for your country."
            >
              <Field label="Highest completed education">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {EDUCATION_LEVELS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEducation(opt)}
                      className={clsx(
                        "rounded-lg border px-3 py-2.5 text-left text-sm transition",
                        opt === education
                          ? "border-accent bg-accent/10 text-fg-primary"
                          : "border-border-default bg-bg-base text-fg-secondary hover:border-border-strong hover:text-fg-primary"
                      )}
                    >
                      <span className="block font-medium">{opt}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Years of work experience (formal or informal)">
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
                    {years}y
                  </span>
                </div>
              </Field>
            </StepBody>
          )}

          {step === 1 && (
            <StepBody
              title="What languages and concrete skills do you have?"
              hint="Type freely. Press Enter or comma to add a chip. Click suggestions to add quickly."
            >
              <Field label={labels.languages}>
                <SkillChipInput
                  value={languages}
                  onChange={setLanguages}
                  suggestions={langSuggestions}
                  placeholder="Type a language and press Enter..."
                  ariaLabel={labels.languages}
                />
              </Field>
              <Field label={`${labels.skills} (optional)`}>
                <SkillChipInput
                  value={skills}
                  onChange={setSkills}
                  suggestions={SKILL_SUGGESTIONS}
                  placeholder="Add a specific skill..."
                  ariaLabel={labels.skills}
                />
              </Field>
            </StepBody>
          )}

          {step === 2 && (
            <StepBody
              title="In your own words: what do you do?"
              hint="Tell us what you do, what you have taught yourself, and what people pay you for. The more specific, the better the match."
              actions={
                <button
                  type="button"
                  onClick={fillSample}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-[11px] text-fg-secondary hover:border-accent/40 hover:text-accent"
                >
                  <Wand2 className="h-3 w-3" /> Try sample
                </button>
              }
            >
              <Field
                label={labels.story}
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
                  Error: {error}
                </p>
              )}
            </StepBody>
          )}
        </div>

        <footer className="mt-7 flex items-center justify-between gap-3 border-t border-border-default pt-5">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0 || loading}
            className="inline-flex items-center gap-2 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-sm text-fg-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <p className="text-[11px] text-fg-muted">
            Step {step + 1} of {STEPS.length}
          </p>
          {step < 2 ? (
            <button
              type="button"
              onClick={next}
              disabled={!stepValid[step]}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={loading || !storyValid}
              className="group inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Mapping to ESCO...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> {labels.submit}
                </>
              )}
            </button>
          )}
        </footer>
      </section>

      {/* SUMMARY / PREVIEW */}
      <aside className="rounded-2xl border border-border-default bg-bg-raised p-6">
        <p className="text-[10px] uppercase tracking-widest text-fg-muted">Profile draft</p>
        <h3 className="mt-1 text-base font-medium text-fg-primary">
          What will be sent to the matcher
        </h3>

        <dl className="mt-5 space-y-3 text-sm">
          <Row label="Country" value={countryName} />
          <Row label="Education" value={education} />
          <Row label="Years experience" value={`${years}y`} />
          <Row
            label="Languages"
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
                "Not added yet"
              )
            }
          />
          <Row
            label="Skills"
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
                "Optional"
              )
            }
          />
          <Row
            label="Story"
            value={
              story.trim().length === 0
                ? "Not written yet"
                : `${story.trim().length} characters`
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

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const status: "done" | "active" | "pending" =
          i < step ? "done" : i === step ? "active" : "pending";
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={clsx(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-medium",
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
                status === "active" ? "text-fg-primary" : "text-fg-muted"
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={clsx(
                  "h-px flex-1",
                  i < step ? "bg-positive/40" : "bg-border-default"
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
  onReset,
  onExportJSON,
  onExportPDF,
}: {
  profile: SkillsProfile;
  countryName: string;
  opportunitiesHref: string;
  onReset: () => void;
  onExportJSON: () => void;
  onExportPDF: () => void;
}) {
  return (
    <div className="space-y-4 animate-[slideUp_220ms_ease-out]">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-default bg-bg-raised p-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-fg-muted">
            Portable profile · {countryName}
          </p>
          <p className="mt-1 text-fg-primary">
            {profile.skills.length} ESCO-mapped skills
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-hover"
          >
            Edit again
          </button>
          <button
            onClick={onExportJSON}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-hover"
          >
            <FileJson className="h-3.5 w-3.5" /> JSON
          </button>
          <button
            onClick={onExportPDF}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-hover"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
          <Link
            href={opportunitiesHref}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-strong"
          >
            Opportunities <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {profile.skills.map((s, i) => (
          <SkillCard key={s.escoCode + s.name} skill={s} index={i} />
        ))}
      </div>
    </div>
  );
}

function SkillCard({ skill, index }: { skill: SkillEvidence; index: number }) {
  return (
    <article
      className="rounded-xl border border-border-default bg-bg-raised p-4 transition hover:border-border-strong"
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
          Why this skill?
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
