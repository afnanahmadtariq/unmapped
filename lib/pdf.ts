// UNMAPPED - PDF generation for the portable skills profile.
// Uses jsPDF (client-side). Brand band header, 2-column metadata, sectioned skills,
// code badges, page footer with page numbers + brand strip.

import { jsPDF } from "jspdf";
import type { SkillsProfile } from "@/types";

const COLOR_BRAND = [3, 105, 161] as const;        // sky-700
const COLOR_BRAND_DARK = [12, 74, 110] as const;   // sky-900
const COLOR_TEXT = [10, 10, 10] as const;
const COLOR_MUTED = [115, 115, 115] as const;
const COLOR_LINE = [229, 229, 229] as const;
const COLOR_CHIP_BG = [240, 249, 255] as const;
const COLOR_CHIP_FG = [3, 105, 161] as const;

const PAGE = { w: 595.28, h: 841.89 }; // A4 in pt
const MARGIN = 48;
const COL_W = PAGE.w - MARGIN * 2;
const FOOTER_Y = PAGE.h - 30;

interface BuildOpts {
  profile: SkillsProfile;
  countryName: string;
  locale: string;
  appName?: string;
}

export function buildSkillsProfilePdf({
  profile,
  countryName,
  locale,
  appName = "UNMAPPED",
}: BuildOpts): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let pageNum = 1;

  drawHeaderBand(doc, appName);
  let y = 130;
  y = drawTitleBlock(doc, y, profile, countryName, locale);
  y = drawMetaTable(doc, y, profile);

  // Group skills by category prefix (S1, S2, ... read from escoCode)
  const groups = groupSkills(profile);
  for (const [groupLabel, items] of groups) {
    if (y > PAGE.h - 180) {
      drawFooter(doc, pageNum);
      doc.addPage();
      pageNum += 1;
      drawHeaderBand(doc, appName);
      y = 130;
    }
    y = drawSectionHeader(doc, y, groupLabel);
    for (const skill of items) {
      const blockHeight = estimateSkillHeight(doc, skill);
      if (y + blockHeight > PAGE.h - 60) {
        drawFooter(doc, pageNum);
        doc.addPage();
        pageNum += 1;
        drawHeaderBand(doc, appName);
        y = 130;
        y = drawSectionHeader(doc, y, groupLabel + " (cont.)");
      }
      y = drawSkillCard(doc, y, skill);
    }
  }

  drawFooter(doc, pageNum);
  return doc;
}

function drawHeaderBand(doc: jsPDF, appName: string) {
  doc.setFillColor(...COLOR_BRAND);
  doc.rect(0, 0, PAGE.w, 70, "F");
  doc.setFillColor(...COLOR_BRAND_DARK);
  doc.rect(0, 70, PAGE.w, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(appName, MARGIN, 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Open Skills Infrastructure", MARGIN, 58);

  doc.setFontSize(9);
  doc.text(
    "Portable skills profile · ESCO + ISCO-08",
    PAGE.w - MARGIN,
    42,
    { align: "right" }
  );
  doc.text(
    "World Bank Youth Summit · Hack-Nation 2026",
    PAGE.w - MARGIN,
    58,
    { align: "right" }
  );
}

function drawTitleBlock(
  doc: jsPDF,
  y: number,
  profile: SkillsProfile,
  countryName: string,
  locale: string
): number {
  doc.setTextColor(...COLOR_TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Skills Profile", MARGIN, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_MUTED);
  const generated = new Date(profile.generatedAt).toLocaleString();
  doc.text(
    `Country: ${countryName}   ·   Locale: ${locale.toUpperCase()}   ·   Generated: ${generated}`,
    MARGIN,
    y
  );
  return y + 18;
}

function drawMetaTable(doc: jsPDF, y: number, profile: SkillsProfile): number {
  const rows: Array<[string, string]> = [
    ["Education", profile.educationLevel || "-"],
    ["Years of experience", `${profile.yearsExperience}`],
    ["Languages", profile.languages.join(", ") || "-"],
  ];
  if (profile.demographics?.ageRange) rows.push(["Age range", profile.demographics.ageRange]);
  if (profile.demographics?.gender) rows.push(["Gender", profile.demographics.gender]);
  if (profile.demographics?.location) rows.push(["Location", profile.demographics.location]);
  if (profile.demographics?.workMode) rows.push(["Current work mode", profile.demographics.workMode]);

  const ctx = profile.context;
  if (ctx?.phoneAccess) rows.push(["Phone access", ctx.phoneAccess]);
  if (ctx?.selfLearning?.length) rows.push(["Self-learning", ctx.selfLearning.join(", ")]);
  if (ctx?.tasks?.length) rows.push(["Tasks", ctx.tasks.join(", ")]);
  if (ctx?.tools?.length) rows.push(["Tools", ctx.tools.join(", ")]);
  if (ctx?.workEntries?.length) {
    rows.push([
      "Work history",
      ctx.workEntries
        .map((w) => `${w.activity} (${w.years}y, ${w.frequency}${w.paid ? "" : ", unpaid"})`)
        .join("; "),
    ]);
  }
  if (ctx?.constraints) {
    const c = ctx.constraints;
    const parts: string[] = [];
    if (c.maxTravelKm != null) parts.push(`travel <= ${c.maxTravelKm}km`);
    if (c.needIncomeNow) parts.push("needs income now");
    if (c.canStudy === false) parts.push("cannot study");
    if (c.canStudy === true) parts.push("can study");
    if (c.hasInternet === false) parts.push("no internet");
    if (c.hasInternet === true) parts.push("has internet");
    if (parts.length) rows.push(["Constraints", parts.join("; ")]);
  }
  if (ctx?.aspirations) rows.push(["Aspirations", ctx.aspirations]);

  // Two-column layout: split rows down the middle
  const half = Math.ceil(rows.length / 2);
  const left = rows.slice(0, half);
  const right = rows.slice(half);
  const colW = COL_W / 2;
  const startY = y + 8;
  drawColumn(doc, MARGIN, startY, colW - 12, left);
  drawColumn(doc, MARGIN + colW + 12, startY, colW - 12, right);
  const rowsHeight = Math.max(left.length, right.length) * 22;

  // Divider line below
  const endY = startY + rowsHeight + 8;
  doc.setDrawColor(...COLOR_LINE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, endY, PAGE.w - MARGIN, endY);

  return endY + 18;
}

function drawColumn(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  rows: Array<[string, string]>
) {
  rows.forEach((r, i) => {
    const ry = y + i * 22;
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(r[0].toUpperCase(), x, ry);
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_TEXT);
    const lines = doc.splitTextToSize(r[1], w);
    doc.text(lines.slice(0, 1), x, ry + 12);
  });
}

function drawSectionHeader(doc: jsPDF, y: number, label: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_BRAND_DARK);
  doc.text(label.toUpperCase(), MARGIN, y);
  doc.setDrawColor(...COLOR_BRAND);
  doc.setLineWidth(1);
  doc.line(MARGIN, y + 4, MARGIN + 30, y + 4);
  return y + 18;
}

function drawSkillCard(
  doc: jsPDF,
  y: number,
  skill: SkillsProfile["skills"][number]
): number {
  const padding = 10;
  const startY = y;

  // Compute card body height first (for the background box)
  const evidenceLines = doc.splitTextToSize(
    `Evidence: ${skill.evidence}`,
    COL_W - padding * 2 - 6
  );
  const noteLines = skill.durabilityNote
    ? doc.splitTextToSize(
        `Note: ${skill.durabilityNote}`,
        COL_W - padding * 2 - 6
      )
    : [];
  const cardH = 32 + evidenceLines.length * 11 + noteLines.length * 10 + (noteLines.length ? 8 : 0);

  // Background
  doc.setFillColor(252, 252, 253);
  doc.setDrawColor(...COLOR_LINE);
  doc.roundedRect(MARGIN, startY, COL_W, cardH, 6, 6, "FD");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(skill.name, MARGIN + padding, startY + padding + 9);

  // Code badge (right side)
  const codeText = skill.escoCode;
  const cwidth = doc.getTextWidth(codeText) + 12;
  const badgeX = PAGE.w - MARGIN - padding - cwidth;
  const badgeY = startY + padding;
  doc.setFillColor(...COLOR_CHIP_BG);
  doc.roundedRect(badgeX, badgeY - 1, cwidth, 14, 3, 3, "F");
  doc.setFont("courier", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_CHIP_FG);
  doc.text(codeText, badgeX + 6, badgeY + 9);

  // Level (under title)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(skill.level.toUpperCase(), MARGIN + padding, startY + padding + 22);

  // Evidence
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(evidenceLines, MARGIN + padding, startY + padding + 34);

  // Durability note
  if (noteLines.length) {
    const noteY = startY + padding + 34 + evidenceLines.length * 11 + 6;
    doc.setTextColor(...COLOR_MUTED);
    doc.setFontSize(8);
    doc.text(noteLines, MARGIN + padding, noteY);
  }

  return startY + cardH + 8;
}

function estimateSkillHeight(
  doc: jsPDF,
  skill: SkillsProfile["skills"][number]
): number {
  const padding = 10;
  const evidenceLines = doc.splitTextToSize(
    `Evidence: ${skill.evidence}`,
    COL_W - padding * 2 - 6
  );
  const noteLines = skill.durabilityNote
    ? doc.splitTextToSize(
        `Note: ${skill.durabilityNote}`,
        COL_W - padding * 2 - 6
      )
    : [];
  return 32 + evidenceLines.length * 11 + noteLines.length * 10 + (noteLines.length ? 8 : 0) + 8;
}

function drawFooter(doc: jsPDF, page: number) {
  doc.setDrawColor(...COLOR_LINE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, FOOTER_Y - 8, PAGE.w - MARGIN, FOOTER_Y - 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    "UNMAPPED · open skills infrastructure · grounded in ESCO (EU) + ISCO-08 (ILO)",
    MARGIN,
    FOOTER_Y
  );
  doc.text(`Page ${page}`, PAGE.w - MARGIN, FOOTER_Y, { align: "right" });
}

function groupSkills(
  profile: SkillsProfile
): Array<[string, SkillsProfile["skills"]]> {
  const map = new Map<string, SkillsProfile["skills"]>();
  for (const s of profile.skills) {
    const key = categoryFromCode(s.escoCode);
    const arr = map.get(key) ?? [];
    arr.push(s);
    map.set(key, arr);
  }
  return Array.from(map.entries());
}

function categoryFromCode(code: string): string {
  // Code shape: S<group>.<sub>.<seq>, e.g. S2.1.4 -> "S2"
  const m = /^(S\d+)/.exec(code);
  const prefix = m ? m[1] : "Other";
  const labels: Record<string, string> = {
    S1: "Repair & technical trades",
    S2: "Digital & programming",
    S3: "Interpersonal & business",
    S4: "Language",
    S5: "Trades & crafts",
    S6: "Agriculture",
    S7: "Care",
    S8: "Creative",
    S9: "Transport",
    S10: "Construction",
    S11: "Education",
    S12: "Transversal",
  };
  return labels[prefix] ?? "Other";
}
