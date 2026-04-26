// IRCC processing times — high-signal page that lists current expected
// processing times for every permit/visa type. The page is dynamically
// generated server-side, so we hash the relevant section to detect when
// IRCC publishes an update (which they do roughly weekly).
//
// We don't try to diff individual rows — the page is large and the layout
// changes occasionally. A "processing times changed, go look" alert is
// the right granularity for users.

import crypto from "node:crypto";

const URL = "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html";

export async function fetchProcessingTimesHash() {
  const res = await fetch(URL, { headers: { "User-Agent": "ircc-news/0.1" } });
  if (!res.ok) throw new Error(`Processing times ${res.status}`);
  const html = await res.text();

  // Strip script/style + collapse whitespace to ignore non-content noise
  // (analytics tags, tracking IDs that change every load).
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ");

  // Hash just the main content area to be more stable than full-page
  // hashing. The wrapping <main> tag is consistent on Canada.ca.
  const mainMatch = stripped.match(/<main[\s\S]*?<\/main>/i);
  const target = mainMatch ? mainMatch[0] : stripped;
  return crypto.createHash("sha256").update(target).digest("hex");
}

export function diffProcessingTimes(currentHash, lastHash) {
  if (!lastHash) return { changed: false, baseline: true, hash: currentHash };
  return { changed: lastHash !== currentHash, baseline: false, hash: currentHash };
}

export function formatProcessingTimes() {
  return [
    `⏱ <b>IRCC Processing Times Updated</b>`,
    `🇰🇷 <i>IRCC 처리 기간 업데이트</i>`,
    ``,
    `Processing times for permits, visas, citizenship, and PR have changed.`,
    `Check the current numbers at the link below.`,
    ``,
    `🔗 ${URL}`,
  ].join("\n");
}
