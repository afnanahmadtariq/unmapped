"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
import { ArrowUpRight, Download, FileJson, Loader2, Sparkles, Wand2 } from "lucide-react";
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
  "Lower secondary (e.g. BECE / JSC)",
  "Upper secondary (e.g. WASSCE / SSC / HSC)",
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

export default function ProfileWorkbench({
  countryCode,
  countryName,
  locale,
  labels,
  opportunitiesHref,
}: Props) {
  const toast = useToast();
  const [education, setEducation] = useState(EDUCATION_LEVELS[3]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [years, setYears] = useState(3);
  const [story, setStory] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<SkillsProfile | null>(null);

  const langSuggestions = useMemo(
    () => LANGUAGE_SUGGESTIONS_BY_COUNTRY[countryCode] ?? [],
    [countryCode]
  );

  const charCount = story.length;
  const valid = story.trim().length >= 20 && story.trim().length <= 1200;

  const fillSample = () => {
    setStory(SAMPLE_STORIES_BY_COUNTRY[countryCode]);
    if (languages.length === 0) {
      setLanguages(countryCode === "GH" ? ["English", "Twi", "Ga"] : ["Bangla", "English"]);
    }
    if (skills.length === 0) {
      setSkills(["phone repair", "JavaScript", "customer service"]);
    }
    toast.push({ tone: "info", title: "Sample loaded", body: "You can edit before submitting." });
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
    doc.text(`Languages: ${profile.languages.join(", ") || "—"}`, 56, y); y += 16;
    doc.text(`Years of experience: ${profile.yearsExperience}`, 56, y); y += 24;
    doc.setFontSize(13);
    doc.text("Mapped Skills (ESCO)", 56, y);
    y += 18;
    doc.setFontSize(10);
    profile.skills.forEach((s) => {
      if (y > 760) { doc.addPage(); y = 56; }
      doc.setTextColor(0);
      doc.text(`• ${s.name} [${s.escoCode}] — ${s.level}`, 56, y);
      y += 14;
      doc.setTextColor(90);
      const lines = doc.splitTextToSize(`Evidence: ${s.evidence}`, W - 112);
      doc.text(lines, 72, y);
      y += lines.length * 12 + 8;
    });
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      "UNMAPPED — open skills infrastructure. Built on ESCO (EU) + ISCO-08 (ILO) taxonomies.",
      56,
      810
    );
    doc.save(`unmapped-profile-${profile.countryCode}.pdf`);
    toast.push({ tone: "success", title: "PDF downloaded" });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {/* INPUT */}
      <section className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-6">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-base font-medium text-neutral-100">{labels.title}</h2>
          <button
            type="button"
            onClick={fillSample}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-[11px] text-neutral-300 hover:border-sky-500/40 hover:text-sky-300"
          >
            <Wand2 className="h-3 w-3" /> Try sample
          </button>
        </header>

        <div className="space-y-5 text-sm">
          <Field label={labels.education}>
            <select
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 transition focus:border-sky-500/60 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20"
            >
              {EDUCATION_LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>

          <Field label={labels.languages}>
            <SkillChipInput
              value={languages}
              onChange={setLanguages}
              suggestions={langSuggestions}
              placeholder="Type a language and press Enter…"
              ariaLabel={labels.languages}
            />
          </Field>

          <Field label={labels.years}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={30}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="flex-1 accent-sky-500"
              />
              <span className="w-16 rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-1 text-center font-mono text-sm text-sky-300">
                {years}y
              </span>
            </div>
          </Field>

          <Field
            label={labels.story}
            hint={`${charCount}/1200`}
            hintTone={charCount > 1200 ? "danger" : charCount > 20 ? "ok" : "muted"}
          >
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={5}
              placeholder="In your own words: what do you do? What have you taught yourself? What do people pay you for?"
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 transition focus:border-sky-500/60 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20"
            />
          </Field>

          <Field label={`${labels.skills} (optional)`}>
            <SkillChipInput
              value={skills}
              onChange={setSkills}
              suggestions={SKILL_SUGGESTIONS}
              placeholder="Add a specific skill…"
              ariaLabel={labels.skills}
            />
          </Field>

          <button
            onClick={submit}
            disabled={loading || !valid}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-md bg-linear-to-br from-sky-400 to-sky-500 px-5 py-2.5 font-medium text-neutral-950 shadow-[0_0_40px_-10px_rgba(56,189,248,0.6)] transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-500 disabled:shadow-none"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Mapping your story to ESCO…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 transition group-hover:rotate-12" />
                {labels.submit}
              </>
            )}
          </button>

          {error && (
            <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              Error: {error}
            </p>
          )}
        </div>
      </section>

      {/* RESULT */}
      <section>
        {!profile && !loading && (
          <div className="grid h-full place-items-center rounded-2xl border border-dashed border-neutral-800/80 bg-neutral-900/20 p-10 text-center">
            <div className="max-w-sm space-y-2">
              <Sparkles className="mx-auto h-6 w-6 text-neutral-600" />
              <p className="text-sm text-neutral-400">
                Your portable, ESCO-grounded skills profile will appear here.
              </p>
              <p className="text-xs text-neutral-600">
                Tip: hit “Try sample” to autofill Amara’s story.
              </p>
            </div>
          </div>
        )}

        {loading && <ProfileSkeleton />}

        {profile && (
          <div className="space-y-4 animate-[slideUp_220ms_ease-out]">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-800/80 bg-linear-to-br from-neutral-900/50 to-neutral-950 p-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                  Portable profile · {countryName}
                </p>
                <p className="mt-1 text-neutral-200">
                  {profile.skills.length} ESCO-mapped skills
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportJSON}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-700 hover:text-neutral-100"
                >
                  <FileJson className="h-3.5 w-3.5" /> JSON
                </button>
                <button
                  onClick={exportPDF}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-700 hover:text-neutral-100"
                >
                  <Download className="h-3.5 w-3.5" /> PDF
                </button>
                <Link
                  href={opportunitiesHref}
                  className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-sky-400"
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
        )}
      </section>
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
    hintTone === "ok" ? "text-emerald-400" : hintTone === "danger" ? "text-rose-400" : "text-neutral-600";
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-widest text-neutral-500">
          {label}
        </span>
        {hint && <span className={`font-mono text-[10px] ${hintColor}`}>{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function SkillCard({ skill, index }: { skill: SkillEvidence; index: number }) {
  return (
    <article
      className="rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-4 transition hover:border-neutral-700"
      style={{
        animation: `slideUp 320ms ease-out`,
        animationDelay: `${index * 40}ms`,
        animationFillMode: "both",
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-neutral-100">{skill.name}</h3>
        <span className="rounded bg-neutral-800/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-sky-300">
          {skill.escoCode}
        </span>
      </header>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-neutral-500">
        {skill.level}
      </p>
      <details className="mt-3 cursor-pointer text-sm text-neutral-300">
        <summary className="list-none text-sky-400 hover:text-sky-300 [&::-webkit-details-marker]:hidden">
          Why this skill? →
        </summary>
        <p className="mt-2 text-neutral-300">{skill.evidence}</p>
        {skill.durabilityNote && (
          <p className="mt-2 rounded border border-neutral-800 bg-neutral-900/40 px-2 py-1.5 text-xs text-neutral-400">
            ↳ {skill.durabilityNote}
          </p>
        )}
      </details>
    </article>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-16 rounded-2xl border border-neutral-800/60" />
      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-32 rounded-xl border border-neutral-800/60" />
        ))}
      </div>
    </div>
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
