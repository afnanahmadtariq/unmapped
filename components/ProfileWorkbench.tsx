"use client";

import { useState } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
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

export default function ProfileWorkbench({
  countryCode,
  countryName,
  locale,
  labels,
  opportunitiesHref,
}: Props) {
  const [education, setEducation] = useState(EDUCATION_LEVELS[3]);
  const [languages, setLanguages] = useState("");
  const [years, setYears] = useState(3);
  const [story, setStory] = useState("");
  const [skills, setSkills] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<SkillsProfile | null>(null);

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
          languages: languages
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          yearsExperience: years,
          story,
          declaredSkills: skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SkillsProfile;
      setProfile(data);
      // Persist for /opportunities to consume — keyed per country so switching contexts is clean.
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          `unmapped:profile:${countryCode}`,
          JSON.stringify(data)
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const exportJSON = () => {
    if (!profile) return;
    const blob = new Blob([JSON.stringify(profile, null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, `unmapped-profile-${profile.countryCode}.json`);
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
      if (y > 760) {
        doc.addPage();
        y = 56;
      }
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
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
        <h2 className="text-lg font-medium text-neutral-100">{labels.title}</h2>
        <div className="mt-5 space-y-4 text-sm">
          <Field label={labels.education}>
            <select
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2"
            >
              {EDUCATION_LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label={`${labels.languages} (comma-separated)`}>
            <input
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              placeholder="English, Twi, Ga"
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2"
            />
          </Field>
          <Field label={labels.years}>
            <input
              type="number"
              min={0}
              max={40}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-32 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2"
            />
          </Field>
          <Field label={labels.story}>
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={5}
              placeholder="I run a phone repair business and taught myself JavaScript on YouTube. I also help my cousin manage her clothing shop accounts."
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2"
            />
          </Field>
          <Field label={`${labels.skills} (comma-separated, optional)`}>
            <input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="soldering, JavaScript, customer service"
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2"
            />
          </Field>
          <button
            onClick={submit}
            disabled={loading || story.trim().length < 10}
            className="rounded-md bg-sky-500 px-5 py-2.5 font-medium text-neutral-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            {loading ? "Mapping…" : labels.submit}
          </button>
          {error && (
            <p className="text-sm text-red-400">Error: {error}</p>
          )}
        </div>
      </section>

      <section>
        {!profile && !loading && (
          <div className="grid h-full place-items-center rounded-lg border border-dashed border-neutral-800 p-10 text-sm text-neutral-500">
            Your portable skills profile will appear here once mapped.
          </div>
        )}
        {loading && (
          <div className="grid h-full place-items-center rounded-lg border border-neutral-800 bg-neutral-900/30 p-10 text-sm text-neutral-400">
            Mapping your story to ESCO codes…
          </div>
        )}
        {profile && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  Portable profile
                </p>
                <p className="mt-1 text-neutral-200">
                  {profile.skills.length} ESCO-mapped skills · {countryName}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportJSON}
                  className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
                >
                  Export JSON
                </button>
                <button
                  onClick={exportPDF}
                  className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
                >
                  Export PDF
                </button>
                <Link
                  href={opportunitiesHref}
                  className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-sky-400"
                >
                  See Opportunities →
                </Link>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {profile.skills.map((s) => (
                <SkillCard key={s.escoCode + s.name} skill={s} />
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function SkillCard({ skill }: { skill: SkillEvidence }) {
  return (
    <article className="rounded-md border border-neutral-800 bg-neutral-900/30 p-4">
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-neutral-100">{skill.name}</h3>
        <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-sky-300">
          {skill.escoCode}
        </span>
      </header>
      <p className="mt-1 text-xs uppercase tracking-widest text-neutral-500">
        {skill.level}
      </p>
      <details className="mt-3 cursor-pointer text-sm text-neutral-300">
        <summary className="text-sky-400 hover:text-sky-300">
          Why this skill?
        </summary>
        <p className="mt-2 text-neutral-300">{skill.evidence}</p>
        {skill.durabilityNote && (
          <p className="mt-2 text-xs text-neutral-500">
            ↳ {skill.durabilityNote}
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
