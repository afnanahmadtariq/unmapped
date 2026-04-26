"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Check,
  Download,
  FileJson,
  GraduationCap,
  Hammer,
  Languages,
  Link2,
  Loader2,
  Mail,
  PencilLine,
  Plus,
  Share2,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import clsx from "clsx";
import SkillChipInput from "@/components/SkillChipInput";
import ClarificationCard from "@/components/ClarificationCard";
import EmailLinkModal from "@/components/EmailLinkModal";
import VoiceInputButton from "@/components/VoiceInputButton";
import { useToast } from "@/components/Toast";
import { apiClient, ApiError } from "@/lib/apiClient";
import { useUserSession } from "@/lib/userSession";
import { buildSkillsProfilePdf } from "@/lib/pdf";
import {
  buildProfileUrl,
  copyToClipboard,
  nativeShare,
  readProfileFromHash,
} from "@/lib/profileUrl";
import type {
  AgeRange,
  CountryCode,
  Gender,
  PhoneAccess,
  ProfileContext,
  SelfLearningChannel,
  SkillsProfile,
  SkillEvidence,
  TaskPrimitive,
  ToolUsed,
  WorkEntry,
  WorkFrequency,
  WorkMode,
} from "@/types";
import type { ClarifyingQuestion } from "@/lib/apiClient";
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

// Language hints per country. Any country not listed falls back to a sensible
// generic plus the active locale's native language.
const LANGUAGE_SUGGESTIONS_BY_COUNTRY: Record<string, string[]> = {
  GH: ["English", "Twi", "Ga", "Ewe", "Hausa", "Dagbani"],
  BD: ["Bangla", "English", "Chittagonian", "Sylheti", "Hindi", "Urdu"],
  KE: ["Swahili", "English", "Kikuyu", "Luo", "Kalenjin"],
  NG: ["English", "Hausa", "Yoruba", "Igbo", "Pidgin"],
  ZA: ["English", "Zulu", "Xhosa", "Afrikaans", "Sesotho"],
  ET: ["Amharic", "English", "Oromo", "Tigrinya", "Somali"],
  EG: ["Arabic", "English", "French"],
  MA: ["Arabic", "Berber", "French", "English"],
  TN: ["Arabic", "French", "English"],
  DZ: ["Arabic", "Berber", "French"],
  JO: ["Arabic", "English"],
  PK: ["Urdu", "Punjabi", "Sindhi", "Pashto", "English"],
  IN: ["Hindi", "English", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Punjabi"],
  LK: ["Sinhala", "Tamil", "English"],
  NP: ["Nepali", "Maithili", "English", "Hindi"],
  ID: ["Indonesian", "Javanese", "Sundanese", "English"],
  PH: ["Filipino", "English", "Cebuano"],
  VN: ["Vietnamese", "English"],
  TH: ["Thai", "English"],
  MY: ["Malay", "English", "Mandarin", "Tamil"],
  CN: ["Mandarin", "English", "Cantonese"],
  BR: ["Portuguese", "English", "Spanish"],
  MX: ["Spanish", "English"],
  AR: ["Spanish", "English"],
  CO: ["Spanish", "English"],
  PE: ["Spanish", "Quechua", "English"],
  CL: ["Spanish", "English"],
  TR: ["Turkish", "Kurdish", "English"],
  RU: ["Russian", "English"],
  UA: ["Ukrainian", "Russian", "English"],
  FR: ["French", "English"],
  DE: ["German", "English", "Turkish"],
  ES: ["Spanish", "Catalan", "English"],
  PT: ["Portuguese", "English"],
  GB: ["English"],
  US: ["English", "Spanish"],
  CA: ["English", "French"],
  AU: ["English"],
  RW: ["Kinyarwanda", "English", "French", "Swahili"],
  UG: ["English", "Swahili", "Luganda"],
  TZ: ["Swahili", "English"],
  SN: ["French", "Wolof", "English"],
  CI: ["French", "English"],
  CM: ["French", "English"],
  MZ: ["Portuguese", "English"],
  AO: ["Portuguese", "English"],
  MM: ["Burmese", "English"],
  KH: ["Khmer", "English"],
  AF: ["Pashto", "Dari", "Urdu", "English"],
  IR: ["Persian", "Azerbaijani", "Kurdish", "English"],
};

const DEFAULT_LANG_SUGGESTIONS = ["English"];

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

const SAMPLE_STORIES_BY_COUNTRY: Record<string, string> = {
  GH: "I run a phone repair business in Accra and have done since I was 17. I taught myself JavaScript from YouTube videos and built a small website for my cousin's clothing shop. I also help her keep the books and answer customers in English, Twi and Ga.",
  BD: "I work in a small electronics repair shop in Dhaka. I learned to fix laptops and routers on the job over four years. Recently I started using Python to automate inventory tracking for my employer. I sometimes help my sister sell hand-stitched garments online in Bangla and English.",
  KE: "I sell second-hand phones and offer basic repairs at a stall in Eastleigh, Nairobi. I learned screen replacements from a cousin and now also flash software for customers. Last year I started selling on Jumia and managing a small WhatsApp catalogue for repeat customers.",
  PK: "I have been doing motorbike repairs at my uncle's workshop in Lahore for five years. I am self-taught with carburettors and electrical wiring. I also help my sister handle accounts for her tailoring business and use a phone app to track orders.",
  IN: "I do delivery work for an aggregator in Bengaluru and run a small mobile-recharge shop in the evenings. I am comfortable with UPI payments, basic Excel, and I keep a customer list in a notebook that I am moving to a Google Sheet.",
  NG: "I plait hair in my neighbourhood in Lagos and have built a small Instagram following with reels of my work. I take bookings on WhatsApp and recently started training two younger girls who help me on weekends.",
};

const GENERIC_SAMPLE = "I work informally in my neighbourhood. I have learned several practical skills on the job and want to know how they map to formal opportunities and which adjacent skills would help me grow.";

function sampleStoryFor(code: string): string {
  return SAMPLE_STORIES_BY_COUNTRY[code] ?? GENERIC_SAMPLE;
}

function selfLearningLabel(k: SelfLearningChannel, t: Dictionary): string {
  switch (k) {
    case "youtube": return t.profile.learnYouTube;
    case "apprenticeship": return t.profile.learnApprentice;
    case "work": return t.profile.learnWork;
    case "family": return t.profile.learnFamily;
    case "course": return t.profile.learnCourse;
  }
}

function taskLabel(k: TaskPrimitive, t: Dictionary): string {
  switch (k) {
    case "fixed-built": return t.profile.taskFixedBuilt;
    case "customer-talk": return t.profile.taskCustomerTalk;
    case "managed-money": return t.profile.taskManagedMoney;
    case "used-tech": return t.profile.taskUsedTech;
    case "taught-others": return t.profile.taskTaughtOthers;
    case "sold-products": return t.profile.taskSoldProducts;
  }
}

function toolLabel(k: ToolUsed, t: Dictionary): string {
  switch (k) {
    case "smartphone": return t.profile.toolSmartphone;
    case "computer": return t.profile.toolComputer;
    case "machinery": return t.profile.toolMachinery;
    case "internet-tools": return t.profile.toolInternetTools;
  }
}

function languageSuggestionsFor(code: string): string[] {
  return LANGUAGE_SUGGESTIONS_BY_COUNTRY[code] ?? DEFAULT_LANG_SUGGESTIONS;
}

const SAMPLE_CITY_BY_COUNTRY: Record<string, string> = {
  GH: "Accra", BD: "Dhaka", KE: "Nairobi", NG: "Lagos", ZA: "Johannesburg",
  ET: "Addis Ababa", EG: "Cairo", MA: "Casablanca", TN: "Tunis", DZ: "Algiers",
  JO: "Amman", PK: "Lahore", IN: "Bengaluru", LK: "Colombo", NP: "Kathmandu",
  ID: "Jakarta", PH: "Manila", VN: "Hanoi", TH: "Bangkok", MY: "Kuala Lumpur",
  CN: "Shanghai", BR: "São Paulo", MX: "Mexico City", AR: "Buenos Aires",
  CO: "Bogotá", PE: "Lima", CL: "Santiago", TR: "Istanbul", RU: "Moscow",
  UA: "Kyiv", FR: "Paris", DE: "Berlin", ES: "Madrid", PT: "Lisbon",
  GB: "London", US: "Chicago", CA: "Toronto", AU: "Sydney", RW: "Kigali",
  UG: "Kampala", TZ: "Dar es Salaam", SN: "Dakar", CI: "Abidjan",
  CM: "Yaoundé", MZ: "Maputo", AO: "Luanda", MM: "Yangon", KH: "Phnom Penh",
  AF: "Kabul", IR: "Tehran",
};

type Step = 0 | 1 | 2 | 3 | 4;

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
  const [storyInterim, setStoryInterim] = useState("");

  // New context state (Phase 8 expansion)
  const [phoneAccess, setPhoneAccess] = useState<PhoneAccess | undefined>(undefined);
  const [selfLearning, setSelfLearning] = useState<SelfLearningChannel[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [tasks, setTasks] = useState<TaskPrimitive[]>([]);
  const [tools, setTools] = useState<ToolUsed[]>([]);
  const [maxTravelKm, setMaxTravelKm] = useState<number | undefined>(undefined);
  const [needIncomeNow, setNeedIncomeNow] = useState<boolean | undefined>(undefined);
  const [canStudy, setCanStudy] = useState<boolean | undefined>(undefined);
  const [hasInternet, setHasInternet] = useState<boolean | undefined>(undefined);
  const [aspirations, setAspirations] = useState("");

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
  const [emailModal, setEmailModal] = useState<{ open: boolean; url: string }>({
    open: false,
    url: "",
  });

  const { user: signedInUser } = useUserSession();
  const searchParamsHook = useSearchParams();
  const prefillRequested =
    searchParamsHook?.get("prefill") === "1" ||
    searchParamsHook?.get("prefill") === "true";

  // On first mount, if a profile is encoded in the URL hash, hydrate it
  // straight into the result view so the user can see/edit/re-share without
  // re-typing anything.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromHash = readProfileFromHash();
    if (fromHash) {
      setProfile(fromHash);
      sessionStorage.setItem(
        `unmapped:profile:${fromHash.countryCode}`,
        JSON.stringify(fromHash)
      );
      toast.push({
        tone: "info",
        title: t.profile.loadedFromLinkTitle,
        body: t.profile.loadedFromLinkBody,
      });
    }
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the session resolves, optionally hydrate from the user's saved
  // profile for this country. Two modes:
  //   - default landing  → jump to the result view (returning visitor UX)
  //   - `?prefill=1`     → seed wizard fields so they can re-extract
  // Skipped when the URL hash already provided a profile.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!signedInUser) return;
    if (readProfileFromHash()) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiClient.meGetProfile(countryCode);
        if (cancelled) return;
        const saved = res.profile;
        if (prefillRequested) {
          seedFormFromExtractInput(saved.extractInput);
          toast.push({
            tone: "info",
            title: "Saved profile loaded",
            body: "We pre-filled your last answers — adjust anything that changed and re-run.",
          });
        } else {
          setProfile(saved.skillsProfile as unknown as SkillsProfile);
          toast.push({
            tone: "info",
            title: "Welcome back",
            body: "Showing your saved profile. Refresh insights or update inputs any time.",
          });
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return;
        // best-effort: anonymous fallback if the call fails for any reason
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedInUser, countryCode, prefillRequested]);

  // Hydrates the form state from a previously-saved `extractInput` blob.
  // Tolerant of partial / legacy payloads — any missing field stays at
  // whatever the wizard's default is.
  const seedFormFromExtractInput = (raw: Record<string, unknown>) => {
    const get = <T,>(key: string): T | undefined => raw[key] as T | undefined;
    const eduLevel = get<string>("educationLevel");
    if (eduLevel) {
      const matchKey = EDUCATION_KEYS.find(
        (k) => t.profile.education[k]?.toLowerCase() === eduLevel.toLowerCase(),
      );
      if (matchKey) setEducationKey(matchKey);
    }
    const yrs = get<number>("yearsExperience");
    if (typeof yrs === "number") setYears(yrs);
    const langs = get<string[]>("languages");
    if (Array.isArray(langs)) setLanguages(langs);
    const decl = get<string[]>("declaredSkills");
    if (Array.isArray(decl)) setSkills(decl);
    const storyTxt = get<string>("story");
    if (typeof storyTxt === "string") setStory(storyTxt);
    const demo = get<Record<string, unknown>>("demographics");
    if (demo) {
      if (typeof demo.ageRange === "string") setAgeRange(demo.ageRange as AgeRange);
      if (typeof demo.gender === "string") setGender(demo.gender as Gender);
      if (typeof demo.workMode === "string") setWorkMode(demo.workMode as WorkMode);
      if (typeof demo.location === "string") setLocation(demo.location);
    }
    const ctx = get<Record<string, unknown>>("context");
    if (ctx) {
      if (typeof ctx.phoneAccess === "string")
        setPhoneAccess(ctx.phoneAccess as PhoneAccess);
      if (Array.isArray(ctx.selfLearning))
        setSelfLearning(ctx.selfLearning as SelfLearningChannel[]);
      if (Array.isArray(ctx.workEntries))
        setWorkEntries(ctx.workEntries as WorkEntry[]);
      if (Array.isArray(ctx.tasks)) setTasks(ctx.tasks as TaskPrimitive[]);
      if (Array.isArray(ctx.tools)) setTools(ctx.tools as ToolUsed[]);
      if (typeof ctx.aspirations === "string") setAspirations(ctx.aspirations);
      const c = ctx.constraints as Record<string, unknown> | undefined;
      if (c) {
        if (typeof c.maxTravelKm === "number") setMaxTravelKm(c.maxTravelKm);
        if (typeof c.needIncomeNow === "boolean")
          setNeedIncomeNow(c.needIncomeNow);
        if (typeof c.canStudy === "boolean") setCanStudy(c.canStudy);
        if (typeof c.hasInternet === "boolean") setHasInternet(c.hasInternet);
      }
    }
  };

  const langSuggestions = useMemo(
    () => languageSuggestionsFor(countryCode),
    [countryCode]
  );

  const STEPS = [
    { key: 0 as Step, label: t.profile.step1Title, icon: GraduationCap },
    { key: 1 as Step, label: t.profile.step2Title, icon: Languages },
    { key: 2 as Step, label: t.profile.step3Title, icon: Briefcase },
    { key: 3 as Step, label: t.profile.step4Title, icon: Hammer },
    { key: 4 as Step, label: t.profile.step5Title, icon: PencilLine },
  ];

  const charCount = story.length;
  const storyValid = story.trim().length >= 20 && story.trim().length <= 1200;
  const stepValid: Record<Step, boolean> = {
    0: !!educationKey,
    1: true,
    2: true, // optional, can skip with no entries
    3: true, // optional
    4: storyValid,
  };

  const fillSample = () => {
    setStory(sampleStoryFor(countryCode));
    if (languages.length === 0) {
      // Take the country's first 2-3 native language hints
      setLanguages(languageSuggestionsFor(countryCode).slice(0, 3));
    }
    if (skills.length === 0) {
      setSkills(["phone repair", "customer service", "bookkeeping"]);
    }
    if (!ageRange) setAgeRange("18_24");
    if (!workMode) setWorkMode("informal");
    if (!location) setLocation(SAMPLE_CITY_BY_COUNTRY[countryCode] ?? countryName);
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
    if (signedInUser) {
      void persistProfile(data);
    }
  };

  // Persist the freshly-extracted profile to the user's account. We also
  // recompute /profile/match in the background so the saved row contains
  // matches + iscoCodes — the /account dashboard uses both immediately.
  // All errors are swallowed: anonymous-equivalent UX always wins.
  const persistProfile = async (data: SkillsProfile) => {
    try {
      const baseInput = {
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
        context: buildContext(),
      } as Record<string, unknown>;
      let matches: { matches: unknown[] } | null = null;
      let iscoCodes: string[] = [];
      try {
        const res = await apiClient.matchOccupations({
          profile: data,
          countryCode,
        });
        matches = res as unknown as { matches: unknown[] };
        iscoCodes = res.matches.map((m) => m.iscoCode);
      } catch {
        // best-effort
      }
      await apiClient.meUpsertProfile({
        countryCode,
        extractInput: baseInput,
        skillsProfile: data as unknown as Record<string, unknown>,
        matches: matches as unknown as Record<string, unknown> | null,
        iscoCodes,
      });
      toast.push({
        tone: "success",
        title: "Saved to your account",
        body: "We'll use this to greet you with refreshed insights next time.",
      });
    } catch {
      // Silent — saving is purely additive; the wizard already succeeded.
    }
  };

  const buildContext = (): ProfileContext | undefined => {
    const constraints =
      maxTravelKm != null || needIncomeNow != null || canStudy != null || hasInternet != null
        ? { maxTravelKm, needIncomeNow, canStudy, hasInternet }
        : undefined;
    const ctx: ProfileContext = {
      phoneAccess,
      selfLearning: selfLearning.length ? selfLearning : undefined,
      workEntries: workEntries.length ? workEntries : undefined,
      tasks: tasks.length ? tasks : undefined,
      tools: tools.length ? tools : undefined,
      constraints,
      aspirations: aspirations.trim() || undefined,
    };
    const hasAnything = Object.values(ctx).some((v) => v !== undefined);
    return hasAnything ? ctx : undefined;
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    setProfile(null);
    setClarify(null);
    setConversation(null);
    try {
      const data = await apiClient.extractInitial({
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
        context: buildContext(),
      });
      const baseInput = data.baseInput;
      const history = data.history;
      if (data.result?.kind === "clarify") {
        setClarify({ reason: data.result.reason, questions: data.result.questions });
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
      const data = await apiClient.extractFollowUp({
        history: conversation.history,
        lastAssistant: conversation.lastAssistant,
        answers,
        baseInput: conversation.baseInput,
      });
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

  const next = () => setStep((s) => (Math.min(4, s + 1) as Step));
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

  const openEmailModal = () => {
    if (!profile) return;
    const sp = new URLSearchParams({ country: profile.countryCode, locale });
    const url = buildProfileUrl(profile, "/profile", sp);
    setEmailModal({ open: true, url });
  };

  // Build a stable URL that contains the profile in the hash, then either
  // open the native share sheet (mobile) or copy to clipboard (desktop).
  const shareProfile = async () => {
    if (!profile) return;
    const sp = new URLSearchParams({
      country: profile.countryCode,
      locale: locale,
    });
    const url = buildProfileUrl(profile, "/profile", sp);
    const native = await nativeShare(
      "My UNMAPPED skills profile",
      `${profile.skills.length} ESCO skills (${countryName})`,
      url
    );
    if (native) return;
    const ok = await copyToClipboard(url);
    if (ok) {
      toast.push({
        tone: "success",
        title: t.profile.linkCopied,
        body: t.profile.linkCopiedBody,
      });
    } else {
      toast.push({ tone: "error", title: t.profile.linkCopyFailed });
    }
  };

  if (profile) {
    return (
      <>
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
          onShare={shareProfile}
          onEmail={openEmailModal}
        />
        <EmailLinkModal
          open={emailModal.open}
          onClose={() => setEmailModal({ open: false, url: "" })}
          url={emailModal.url}
          countryName={countryName}
          skillCount={profile.skills.length}
          t={t}
        />
      </>
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

              <Field label={t.profile.fieldPhoneAccess}>
                <ChipGroup
                  options={[
                    { key: "own", label: t.profile.phoneOwn },
                    { key: "shared", label: t.profile.phoneShared },
                    { key: "none", label: t.profile.phoneNone },
                  ]}
                  value={phoneAccess}
                  onChange={(v) => setPhoneAccess(v as PhoneAccess)}
                />
              </Field>
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
              <Field label={t.profile.fieldSelfLearning}>
                <MultiChipGroup
                  options={[
                    { key: "youtube", label: t.profile.learnYouTube },
                    { key: "apprenticeship", label: t.profile.learnApprentice },
                    { key: "work", label: t.profile.learnWork },
                    { key: "family", label: t.profile.learnFamily },
                    { key: "course", label: t.profile.learnCourse },
                  ]}
                  value={selfLearning}
                  onChange={(v) => setSelfLearning(v as SelfLearningChannel[])}
                />
              </Field>
            </StepBody>
          )}

          {step === 2 && (
            <StepBody
              title={t.profile.step3Heading}
              hint={t.profile.step3Hint}
            >
              <WorkEntryEditor
                entries={workEntries}
                onChange={setWorkEntries}
                t={t}
              />
            </StepBody>
          )}

          {step === 3 && (
            <StepBody
              title={t.profile.step4Heading}
              hint={t.profile.step4Hint}
            >
              <Field label={t.profile.fieldTasks}>
                <MultiChipGroup
                  options={[
                    { key: "fixed-built", label: t.profile.taskFixedBuilt },
                    { key: "customer-talk", label: t.profile.taskCustomerTalk },
                    { key: "managed-money", label: t.profile.taskManagedMoney },
                    { key: "used-tech", label: t.profile.taskUsedTech },
                    { key: "taught-others", label: t.profile.taskTaughtOthers },
                    { key: "sold-products", label: t.profile.taskSoldProducts },
                  ]}
                  value={tasks}
                  onChange={(v) => setTasks(v as TaskPrimitive[])}
                />
              </Field>
              <Field label={t.profile.fieldTools}>
                <MultiChipGroup
                  options={[
                    { key: "smartphone", label: t.profile.toolSmartphone },
                    { key: "computer", label: t.profile.toolComputer },
                    { key: "machinery", label: t.profile.toolMachinery },
                    { key: "internet-tools", label: t.profile.toolInternetTools },
                  ]}
                  value={tools}
                  onChange={(v) => setTools(v as ToolUsed[])}
                />
              </Field>
            </StepBody>
          )}

          {step === 4 && (
            <StepBody
              title={t.profile.step5Heading}
              hint={t.profile.step5Hint}
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
                <div className="space-y-2">
                  <div className="flex items-center justify-end">
                    <VoiceInputButton
                      locale={locale}
                      value={story}
                      onAppend={(next) => setStory(next)}
                      onInterim={setStoryInterim}
                      t={t}
                    />
                  </div>
                  <textarea
                    value={story}
                    onChange={(e) => setStory(e.target.value)}
                    rows={5}
                    placeholder={sampleStoryFor(countryCode).slice(0, 80) + "..."}
                    className="w-full rounded-md border border-border-default bg-bg-base px-3 py-2 text-fg-primary transition focus:border-accent/60 focus:outline-hidden focus:ring-2 focus:ring-accent/20"
                  />
                  {storyInterim && (
                    <p className="rounded-md border border-dashed border-accent/40 bg-accent/5 px-2 py-1 text-xs italic text-accent">
                      {t.profile.voiceInterimHint} {storyInterim}
                    </p>
                  )}
                </div>
              </Field>

              <Field label={t.profile.fieldConstraints}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 rounded-md border border-border-default bg-bg-base px-3 py-2 text-sm">
                    <span className="text-fg-secondary">{t.profile.constraintTravel}</span>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={maxTravelKm ?? ""}
                      onChange={(e) =>
                        setMaxTravelKm(e.target.value === "" ? undefined : Number(e.target.value))
                      }
                      className="w-20 rounded border border-border-default bg-bg-raised px-2 py-1 text-right font-mono text-sm text-fg-primary focus:border-accent/60 focus:outline-hidden"
                    />
                  </label>
                  <YesNoChip
                    label={t.profile.constraintIncomeNow}
                    yes={t.profile.constraintYes}
                    no={t.profile.constraintNo}
                    value={needIncomeNow}
                    onChange={setNeedIncomeNow}
                  />
                  <YesNoChip
                    label={t.profile.constraintCanStudy}
                    yes={t.profile.constraintYes}
                    no={t.profile.constraintNo}
                    value={canStudy}
                    onChange={setCanStudy}
                  />
                  <YesNoChip
                    label={t.profile.constraintInternet}
                    yes={t.profile.constraintYes}
                    no={t.profile.constraintNo}
                    value={hasInternet}
                    onChange={setHasInternet}
                  />
                </div>
              </Field>

              <Field label={t.profile.fieldAspirations}>
                <input
                  value={aspirations}
                  onChange={(e) => setAspirations(e.target.value)}
                  placeholder={t.profile.aspirationsPlaceholder}
                  className="w-full rounded-md border border-border-default bg-bg-base px-3 py-2 text-sm text-fg-primary focus:border-accent/60 focus:outline-hidden focus:ring-2 focus:ring-accent/20"
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
          {step < 4 ? (
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
            label={t.profile.draftPhone}
            value={
              phoneAccess
                ? phoneAccess === "own"
                  ? t.profile.phoneOwn
                  : phoneAccess === "shared"
                    ? t.profile.phoneShared
                    : t.profile.phoneNone
                : t.profile.draftEmpty
            }
          />
          <Row
            label={t.profile.draftSelfLearning}
            value={
              selfLearning.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {selfLearning.map((k) => (
                    <span key={k} className="rounded bg-bg-hover px-1.5 py-0.5 text-[11px] text-fg-secondary">
                      {selfLearningLabel(k, t)}
                    </span>
                  ))}
                </span>
              ) : (
                t.profile.draftEmpty
              )
            }
          />
          <Row
            label={t.profile.draftWorkEntries}
            value={
              workEntries.length === 0 ? (
                t.profile.draftEmpty
              ) : (
                <span className="flex flex-col gap-0.5 text-[11px]">
                  {workEntries.map((w, i) => (
                    <span key={i} className="text-fg-secondary">
                      {w.activity || "(unnamed)"} - {w.years}y, {w.frequency}
                      {w.paid ? "" : " (unpaid)"}
                    </span>
                  ))}
                </span>
              )
            }
          />
          <Row
            label={t.profile.draftTasks}
            value={
              tasks.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {tasks.map((k) => (
                    <span key={k} className="rounded bg-bg-hover px-1.5 py-0.5 text-[11px] text-fg-secondary">
                      {taskLabel(k, t)}
                    </span>
                  ))}
                </span>
              ) : (
                t.profile.draftEmpty
              )
            }
          />
          <Row
            label={t.profile.draftTools}
            value={
              tools.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {tools.map((k) => (
                    <span key={k} className="rounded bg-bg-hover px-1.5 py-0.5 text-[11px] text-fg-secondary">
                      {toolLabel(k, t)}
                    </span>
                  ))}
                </span>
              ) : (
                t.profile.draftEmpty
              )
            }
          />
          <Row
            label={t.profile.draftConstraints}
            value={
              maxTravelKm == null && needIncomeNow == null && canStudy == null && hasInternet == null
                ? t.profile.draftEmpty
                : [
                    maxTravelKm != null ? `≤${maxTravelKm}km` : null,
                    needIncomeNow === true ? "income now" : null,
                    canStudy === false ? "cannot study" : canStudy === true ? "can study" : null,
                    hasInternet === false ? "no internet" : hasInternet === true ? "internet" : null,
                  ]
                    .filter(Boolean)
                    .join(", ")
            }
          />
          <Row
            label={t.profile.draftAspirations}
            value={aspirations.trim() || t.profile.draftEmpty}
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

function MultiChipGroup({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: string; label: string }>;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (k: string) => {
    onChange(value.includes(k) ? value.filter((v) => v !== k) : [...value, k]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.key);
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => toggle(o.key)}
            className={clsx(
              "rounded-full border px-3 py-1 text-xs transition",
              on
                ? "border-accent bg-accent/10 text-accent"
                : "border-border-default bg-bg-base text-fg-secondary hover:border-border-strong hover:text-fg-primary"
            )}
          >
            {on ? <Check className="-ml-0.5 mr-1 inline h-3 w-3" /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function YesNoChip({
  label,
  yes,
  no,
  value,
  onChange,
}: {
  label: string;
  yes: string;
  no: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border-default bg-bg-base px-3 py-2 text-sm">
      <span className="text-fg-secondary">{label}</span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onChange(value === true ? undefined : true)}
          className={clsx(
            "rounded-md border px-2 py-0.5 text-xs transition",
            value === true
              ? "border-positive bg-positive/10 text-positive"
              : "border-border-default text-fg-secondary hover:border-border-strong"
          )}
        >
          {yes}
        </button>
        <button
          type="button"
          onClick={() => onChange(value === false ? undefined : false)}
          className={clsx(
            "rounded-md border px-2 py-0.5 text-xs transition",
            value === false
              ? "border-danger bg-danger/10 text-danger"
              : "border-border-default text-fg-secondary hover:border-border-strong"
          )}
        >
          {no}
        </button>
      </div>
    </div>
  );
}

function WorkEntryEditor({
  entries,
  onChange,
  t,
}: {
  entries: WorkEntry[];
  onChange: (next: WorkEntry[]) => void;
  t: Dictionary;
}) {
  const update = (idx: number, patch: Partial<WorkEntry>) => {
    const next = entries.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const add = () => {
    onChange([
      ...entries,
      { activity: "", years: 1, frequency: "weekly", paid: true },
    ]);
  };
  const remove = (idx: number) => {
    onChange(entries.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <p className="rounded-md border border-dashed border-border-default bg-bg-base p-3 text-xs text-fg-muted">
          {t.profile.noWorkEntriesYet}
        </p>
      )}
      {entries.map((e, i) => (
        <div
          key={i}
          className="rounded-lg border border-border-default bg-bg-base p-3 animate-[fadeIn_120ms_ease-out]"
        >
          <div className="flex items-start gap-2">
            <input
              value={e.activity}
              onChange={(ev) => update(i, { activity: ev.target.value })}
              placeholder={t.profile.workActivityPlaceholder}
              className="flex-1 rounded border border-border-default bg-bg-raised px-2 py-1 text-sm text-fg-primary focus:border-accent/60 focus:outline-hidden"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-danger"
              aria-label={t.profile.removeEntry}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <label className="flex items-center gap-1.5">
              <span className="text-fg-muted">{t.profile.workYearsLabel}</span>
              <input
                type="number"
                min={0}
                max={40}
                value={e.years}
                onChange={(ev) => update(i, { years: Number(ev.target.value) })}
                className="w-14 rounded border border-border-default bg-bg-raised px-1.5 py-0.5 text-right font-mono text-xs text-fg-primary focus:border-accent/60 focus:outline-hidden"
              />
            </label>
            <select
              value={e.frequency}
              onChange={(ev) => update(i, { frequency: ev.target.value as WorkFrequency })}
              className="rounded border border-border-default bg-bg-raised px-1.5 py-0.5 text-xs text-fg-primary focus:border-accent/60 focus:outline-hidden"
            >
              <option value="daily">{t.profile.workFreqDaily}</option>
              <option value="weekly">{t.profile.workFreqWeekly}</option>
              <option value="monthly">{t.profile.workFreqMonthly}</option>
              <option value="occasional">{t.profile.workFreqOccasional}</option>
            </select>
            <label className="flex items-center justify-end gap-1.5">
              <input
                type="checkbox"
                checked={e.paid}
                onChange={(ev) => update(i, { paid: ev.target.checked })}
                className="h-3.5 w-3.5 accent-accent"
              />
              <span className="text-fg-muted">{t.profile.workPaidLabel}</span>
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-strong bg-bg-base px-3 py-1.5 text-xs text-fg-secondary hover:border-accent/40 hover:text-accent"
      >
        <Plus className="h-3.5 w-3.5" /> {t.profile.addWorkEntry}
      </button>
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
  onShare,
  onEmail,
}: {
  profile: SkillsProfile;
  countryName: string;
  opportunitiesHref: string;
  t: Dictionary;
  onReset: () => void;
  onExportJSON: () => void;
  onExportPDF: () => void;
  onShare: () => void;
  onEmail: () => void;
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
            onClick={onShare}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
          >
            <Share2 className="h-3.5 w-3.5" /> {t.profile.shareLink}
          </button>
          <button
            onClick={onEmail}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-hover"
          >
            <Mail className="h-3.5 w-3.5" /> {t.profile.emailLink}
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
