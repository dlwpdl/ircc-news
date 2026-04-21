// IRCC news releases — Government of Canada publishes a filterable
// Atom feed per department. `departmentofcitizenshipandimmigration` is
// IRCC. We parse the feed, track seen entry IDs, and emit new ones.
//
// Atom is used because Canada.ca's RSS endpoint is less reliable.

import { XMLParser } from "fast-xml-parser";

const FEED =
  "https://api.io.canada.ca/io-server/gc/news/en/v2" +
  "?dept=departmentofcitizenshipandimmigration" +
  "&sort=publishedDate&orderBy=desc" +
  "&publishedDate%3E=2021-07-23" +
  "&pick=50&format=atom" +
  "&atomtitle=Immigration,%20Refugees%20and%20Citizenship%20Canada";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export async function fetchNews() {
  const res = await fetch(FEED, { headers: { "User-Agent": "ircc-news/0.1" } });
  if (!res.ok) throw new Error(`News feed ${res.status}`);
  const xml = await res.text();
  const parsed = parser.parse(xml);
  const entries = parsed?.feed?.entry;
  if (!entries) return [];
  const list = Array.isArray(entries) ? entries : [entries];
  return list.map((e) => ({
    id: e.id,
    title: typeof e.title === "string" ? e.title : e.title?.["#text"] ?? "",
    summary: typeof e.summary === "string" ? e.summary : e.summary?.["#text"] ?? "",
    published: e.published,
    updated: e.updated,
    link:
      (Array.isArray(e.link) ? e.link.find((l) => l["@_rel"] !== "self") : e.link)?.[
        "@_href"
      ] ?? "",
  }));
}

export function formatNews(item) {
  const summary = stripTags(item.summary).slice(0, 350);
  const date = (item.published || item.updated || "").slice(0, 10);
  return [
    `📰 <b>${escape(item.title)}</b>`,
    date ? `📅 ${date}` : null,
    ``,
    escape(summary) + (summary.length === 350 ? "…" : ""),
    ``,
    `🔗 ${item.link}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function diffNews(feed, seenIds) {
  const seen = new Set(seenIds || []);
  const fresh = feed.filter((e) => e.id && !seen.has(e.id));
  const baseline = !seenIds;
  return { fresh, baseline };
}

function stripTags(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function escape(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
