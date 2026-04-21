// Express Entry draws. IRCC publishes the full history as JSON at this
// URL — updated within minutes of each new draw. The `rounds` array is
// newest-first. Each round has: drawNumber, drawDate, drawCRS,
// drawSize, drawName (category), drawText1 (summary).
//
// We track the highest drawNumber seen and emit Telegram alerts for
// anything newer. First run sets the baseline silently.

import { translateKo } from "../translate.js";

const FEED = "https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json";

function fmtNumber(n) {
  const num = Number(String(n ?? "").replace(/,/g, ""));
  return Number.isFinite(num) ? num.toLocaleString("en-CA") : String(n);
}

export async function fetchExpressEntry() {
  const res = await fetch(FEED, { headers: { "User-Agent": "ircc-news/0.1" } });
  if (!res.ok) throw new Error(`EE feed ${res.status}`);
  const data = await res.json();
  const rounds = Array.isArray(data.rounds) ? data.rounds : [];
  return rounds
    .map((r) => ({
      drawNumber: Number(r.drawNumber),
      drawDate: r.drawDate,
      drawDateFull: r.drawDateFull || r.drawDate,
      drawCRS: r.drawCRS,
      drawSize: r.drawSize,
      drawName: r.drawName,
      drawText1: r.drawText1,
    }))
    .filter((r) => !Number.isNaN(r.drawNumber))
    .sort((a, b) => b.drawNumber - a.drawNumber);
}

export async function formatDraw(draw) {
  const drawNameKo = await translateKo(draw.drawName);
  const lines = [
    `🍁 <b>Express Entry Draw #${draw.drawNumber}</b>`,
    `📅 ${draw.drawDateFull}`,
    `🏷️ ${draw.drawName}`,
    `   🇰🇷 <i>${drawNameKo}</i>`,
    `📊 CRS cutoff: <b>${draw.drawCRS}</b>`,
    `🎟️ ITAs: <b>${fmtNumber(draw.drawSize)}</b>`,
  ];
  return lines.join("\n");
}

export function diffDraws(latest, lastSeenNumber) {
  if (!lastSeenNumber) return { newDraws: [], baseline: latest[0]?.drawNumber ?? null };
  const newDraws = latest.filter((d) => d.drawNumber > lastSeenNumber);
  return { newDraws, baseline: null };
}
