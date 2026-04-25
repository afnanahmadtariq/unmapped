# UNMAPPED

> Open, localizable skills infrastructure for the AI age.
>
> **Challenge:** World Bank Youth Summit × Hack-Nation — Challenge 05
> **Status:** Hackathon prototype (built in 18 hours)

---

## The problem

600 million young people work in the informal economy. Their real skills — phone repair, tailoring, self-taught coding, market trading — are invisible to the formal labor market because no one has mapped them to standardized taxonomies, real wage data, or actual opportunities.

Generic job boards don't help Amara, 22, in Accra. She needs infrastructure that:

- Speaks her language (literally — EN / FR / Bangla)
- Understands her credentials (WASSCE in Ghana, SSC in Bangladesh — not "high school diploma")
- Calibrates AI displacement risk for her context, not for San Francisco
- Surfaces self-employment, gig, and training pathways — not just formal jobs that don't exist

UNMAPPED is the layer underneath the next generation of skills products. Country-specific parameters are **inputs**, not hardcoded assumptions.

---

## Meet Amara

Amara is 22, lives in Accra, repairs phones at a kiosk, and has been teaching herself JavaScript on a shared phone for 14 months. She has no LinkedIn. Her CV doesn't exist. The formal labor market does not see her.

UNMAPPED maps her real skills to **ESCO** + **ISCO-08**, surfaces opportunities backed by **ILOSTAT** wages and **WDI** sector growth, flags AI displacement risk calibrated for Ghana, and gives her a portable JSON / PDF profile she owns.

When the demo switches to Bangladesh, the same infrastructure reconfigures: Bangla script loads, BDT replaces GHS, SSC/HSC replace WASSCE, sector mix shifts, and the Frey-Osborne risk multiplier adjusts. **No code changes.**

---

## What's in the prototype

| Module | Status | What it does |
|---|---|---|
| **01 — Skills Signal Engine** | ✅ Built | Free-text story → ESCO-mapped profile, plain-English tooltips, JSON + PDF export |
| **03 — Opportunity Matching & Dashboard** | ✅ Built | ESCO → ISCO match, surfaces wage + growth + AI-risk on every card, dual interface (youth + policymaker) |
| **02 — AI Readiness Lens** | 🟡 Light | Frey-Osborne badge per occupation with per-country LMIC calibration |

### Country-agnostic by construction

Five things are configurable **without touching the codebase**:

1. **Labor market data** — `/public/data/<country>/wages.json`, `growth.json`
2. **Education taxonomy** — `/public/data/<country>/credentials.json` (WASSCE, NVTI, SSC, HSC, TVET …)
3. **Language & script** — `/locales/{en,fr,bn}.json` via `next-intl`
4. **Automation calibration** — `/public/data/<country>/calibration.json` (LMIC multiplier on Frey-Osborne)
5. **Opportunity types** — formal employment, self-employment, gig, training pathways

Live demo switches between **Ghana** and **Bangladesh** in one click.

---

## Tech stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript strict
- **Styling:** Tailwind CSS 4
- **LLM:** Anthropic Claude Sonnet 4.6 (skills extraction via tool-use, post-filtered against valid ESCO codes)
- **Search:** Tavily API (live formal-job listings)
- **Charts:** Recharts (policymaker dashboard)
- **i18n:** `next-intl` — EN / FR / BN
- **Data:** Static JSON snapshots in `/public/data/` (avoids ILOSTAT/WDI rate limits during judging)
- **Deployment:** Vercel

---

## Data sources & citations

All datasets are real and publicly sourced. Every JSON file in `/public/data/` carries a citation comment.

| Dataset | Used for | Source |
|---|---|---|
| ESCO Skills Taxonomy | Skill normalization | [ec.europa.eu/esco](https://ec.europa.eu/esco) |
| ISCO-08 | Occupational classification | [ilo.org/ISCO](https://www.ilo.org/public/english/bureau/stat/isco/isco08/) |
| ILOSTAT | Median wages, sector employment | [ilostat.ilo.org](https://ilostat.ilo.org) |
| World Bank WDI | Youth unemployment, sector growth | [data.worldbank.org](https://data.worldbank.org) |
| Frey-Osborne (2013) | Automation risk per occupation | *The Future of Employment*, Frey & Osborne, Oxford |
| Wittgenstein Centre | Education projections 2025–2035 | [wittgensteincentre.org](https://www.wittgensteincentre.org) |

---

## Architecture

```
unmapped/
├── app/
│   ├── page.tsx                  Landing + Amara story
│   ├── profile/                  Skills input + ESCO display
│   ├── opportunities/            Youth-facing matches
│   ├── dashboard/                Policymaker view
│   ├── admin/config/             Country-agnostic configurability proof
│   └── api/
│       ├── extract-skills/       Claude → ESCO mapping
│       ├── match-occupations/    Cosine similarity → ISCO codes
│       ├── automation-risk/      Frey-Osborne + LMIC calibration
│       ├── find-jobs/            Tavily formal job search
│       ├── self-employment/      Self-employment opportunities
│       ├── gig-opportunities/    Gig pathways
│       ├── training-pathways/    Local upskilling routes
│       └── explain/              Honest 2-sentence explanations
├── lib/
│   ├── llm.ts                    Anthropic client + tool-use
│   ├── tavily.ts                 Tavily client
│   ├── matcher.ts                ISCO scoring
│   ├── calibration.ts            Per-country automation multipliers
│   ├── credentials.ts            Per-country credential mapping
│   └── config.ts                 Country config registry
├── public/data/
│   ├── esco-skills.json          Top 500 ESCO skills
│   ├── isco-occupations.json     Top 200 ISCO codes
│   ├── frey-osborne.json         Automation probabilities
│   ├── ghana/                    GH wages, growth, credentials, calibration
│   └── bangladesh/               BD wages, growth, credentials, calibration
└── locales/                      en.json, fr.json, bn.json
```

---

## Getting started

```bash
git clone https://github.com/<your-username>/unmapped.git
cd unmapped
npm install
cp .env.local.example .env.local       # add ANTHROPIC_API_KEY and TAVILY_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required env vars

```
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
```

---

## Demo flow

1. Landing page → Amara story → click **Map My Skills**
2. Enter free-text background (phone repair, self-taught JavaScript, no formal CS degree)
3. Profile generates with ESCO codes + plain-English tooltips
4. Click **See Opportunities** → 5 matches with **wage**, **growth**, **AI risk** visible on every card
5. All four opportunity types shown: formal job, self-employment, gig, training
6. Toggle **Ghana → Bangladesh** in the header. UI, currency, sectors, credentials, language all update live.
7. Open `/dashboard` for the policymaker view with charts + CSV export.

---

## Limitations (honest)

This is an 18-hour prototype. We were deliberate about scope:

- **Data is snapshotted, not live.** ILOSTAT and WDI are pre-fetched into `/public/data/`. Production would refresh on a cron.
- **Two countries only.** Ghana and Bangladesh are wired end-to-end. Adding a third country = drop a folder under `/public/data/<country>/` + a locale file. We did not implement an admin UI for it.
- **ESCO subset.** We use the top 500 most-relevant ESCO skills, not the full ~13,000. Long-tail skills will fall back to a "closest match" badge.
- **Frey-Osborne is dated (2013).** We apply an LMIC multiplier as a coarse calibration. A real product would use a recent OECD or McKinsey LMIC-specific automation index.
- **Tavily job search is best-effort.** Results depend on what's on the public web in the target country. Expect lower coverage outside major metros.
- **No auth, no persistence.** Profiles live in the browser; export to JSON/PDF to keep them. A real deployment needs accounts + offline-first sync for low-bandwidth users.
- **PDF export is client-side (jsPDF).** Layout is functional, not beautiful. Server-side rendering with proper typography is a v2 item.
- **No automated tests.** Manual testing only within the hackathon window.

We chose to ship something honest and end-to-end rather than something polished and partial.

---

## License

MIT. Use it, fork it, localize it for your country.

---

## Team & build provenance

Built in 18 hours by a 2-person team for the World Bank Youth Summit × Hack-Nation Challenge 05.

The commit history on this repository is the build log: each milestone in `CLAUDE.md` corresponds to a timestamped commit pushed to `main`. No squash, no rebase, no amend.
