// CIC News — third-party Canadian immigration news. Often scoops IRCC's
// own press releases. Standard WordPress RSS feed.

import { XMLParser } from "fast-xml-parser";
import { translateKo } from "../translate.js";

const FEED = "https://www.cicnews.com/feed/";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export async function fetchCicNews() {
  const res = await fetch(FEED, {
    redirect: "follow",
    headers: { "User-Agent": "ircc-news/0.1" },
  });
  if (!res.ok) throw new Error(`CIC feed ${res.status}`);
  const xml = await res.text();
  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item;
  if (!items) return [];
  const list = Array.isArray(items) ? items : [items];
  return list.slice(0, 20).map((it) => ({
    id: it.guid?.["#text"] ?? it.guid ?? it.link,
    title: it.title ?? "",
    link: it.link ?? "",
    pubDate: it.pubDate ?? "",
    description: stripTags(it.description ?? "").slice(0, 350),
  }));
}

export function diffCicNews(items, seenIds) {
  const seen = new Set(seenIds || []);
  const fresh = items.filter((i) => i.id && !seen.has(i.id));
  return { fresh, baseline: !seenIds };
}

export async function formatCicNews(item) {
  const date = (item.pubDate || "").slice(0, 16);
  const [titleKo, descKo] = await Promise.all([
    translateKo(item.title),
    translateKo(item.description),
  ]);
  return [
    `📡 <b>CIC News — ${escape(item.title)}</b>`,
    `🇰🇷 <i>${escape(titleKo)}</i>`,
    date ? `📅 ${date}` : null,
    ``,
    escape(item.description),
    ``,
    `🇰🇷 ${escape(descKo)}`,
    ``,
    `🔗 ${item.link}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function escape(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
