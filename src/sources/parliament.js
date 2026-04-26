// Parliament of Canada — bills with immigration / citizenship subject.
// LegisInfo XML feed exposes every bill with metadata (status, sponsor,
// long title, latest activity). We filter for immigration keywords and
// track status changes per bill.

import { XMLParser } from "fast-xml-parser";

const FEED = "https://www.parl.ca/LegisInfo/en/bills/xml";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // The full bills feed has thousands of <Bill> entries with entity
  // references; the default expansion limit (1000) trips on a normal
  // payload. We're parsing trusted gov XML so a large cap is fine.
  processEntities: { maxTotalExpansions: 1_000_000 },
});

const KEYWORDS = [
  "immigration",
  "citizenship",
  "refugee",
  "refugees",
  "asylum",
  "irpa",
  "permanent resident",
  "foreign national",
  "newcomer",
  "newcomers",
];

export async function fetchParliament() {
  const res = await fetch(FEED, { headers: { "User-Agent": "ircc-news/0.1" } });
  if (!res.ok) throw new Error(`Parliament feed ${res.status}`);
  const xml = await res.text();
  const parsed = parser.parse(xml);
  const list = parsed?.Bills?.Bill;
  if (!list) return [];
  const bills = Array.isArray(list) ? list : [list];

  return bills
    .filter((b) => b?.IsFromCurrentSession === true || b?.IsFromCurrentSession === "true")
    .filter((b) => {
      const blob = `${b.LongTitleEn ?? ""} ${b.ShortTitleEn ?? ""}`.toLowerCase();
      return KEYWORDS.some((k) => blob.includes(k));
    })
    .map((b) => ({
      id: String(b.BillId ?? b.BillNumberFormatted ?? ""),
      number: b.BillNumberFormatted ?? "",
      titleEn: b.LongTitleEn ?? "",
      shortTitle: b.ShortTitleEn ?? "",
      status: b.CurrentStatusEn ?? "",
      stage: b.LatestCompletedMajorStageEn ?? "",
      latestActivity: b.LatestActivityEn ?? "",
      activityDate: b.LatestActivityDateTime ?? "",
      sponsor: b.SponsorEn ?? "",
      session: b.ParlSessionEn ?? "",
    }));
}

export function diffParliament(bills, lastSeen) {
  // lastSeen: { [billId]: "<status>::<stage>::<activityDate>" }
  // Emit for bills not seen at all (new) or whose signature changed.
  const prev = lastSeen ?? null;
  const changed = [];
  const next = {};
  for (const bill of bills) {
    const sig = `${bill.status}::${bill.stage}::${bill.activityDate}`;
    next[bill.id] = sig;
    if (!prev) continue; // baseline run: don't emit, just record
    if (prev[bill.id] !== sig) changed.push(bill);
  }
  return { changed, next, baseline: !prev };
}

export function formatParliament(bill) {
  const date = (bill.activityDate || "").slice(0, 10);
  return [
    `🏛 <b>Bill ${escape(bill.number)}</b>${
      bill.shortTitle ? ` — ${escape(bill.shortTitle)}` : ""
    }`,
    `📝 ${escape(bill.titleEn)}`,
    `📍 Stage: <b>${escape(bill.stage || "—")}</b>`,
    `🎯 Status: ${escape(bill.status || "—")}`,
    bill.latestActivity ? `🔔 ${escape(bill.latestActivity)}` : null,
    date ? `📅 ${date}` : null,
    bill.sponsor ? `👤 ${escape(bill.sponsor)}` : null,
    ``,
    `🔗 https://www.parl.ca/legisinfo/en/bill/${bill.session.split("~")[0].replace("th Parliament, ", "/").replace("st session", "-1").replace("nd session", "-2").replace("rd session", "-3").trim()}/${bill.number.toLowerCase()}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function escape(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
