// Provincial Nominee Program draws. Each province publishes results
// differently — no consistent feed format — so this file does
// best-effort HTML scraping per province. If a province's layout
// changes, we lose only that province (others continue to work).
//
// MVP coverage: BC PNP + Ontario OINP. AB / SK / MB to follow.
// We track only the most-recent draw date per province and emit a
// single alert when a date appears that we haven't seen before.

const SOURCES = [
  {
    key: "bc",
    name: "BC PNP",
    url:
      "https://www.welcomebc.ca/immigrate-to-b-c/" +
      "about-the-bc-provincial-nominee-program-4374589fc5bd099f34c82a0e2623f93d/" +
      "invitations-to-apply",
    extract: extractBcDates,
  },
  {
    key: "ontario",
    name: "Ontario OINP",
    url: "https://www.ontario.ca/page/2026-ontario-immigrant-nominee-program-updates",
    extract: extractOntarioDates,
  },
];

export async function fetchPnp() {
  const results = [];
  for (const src of SOURCES) {
    try {
      const res = await fetch(src.url, {
        headers: { "User-Agent": "ircc-news/0.1" },
      });
      if (!res.ok) {
        results.push({ key: src.key, name: src.name, url: src.url, dates: [], error: `HTTP ${res.status}` });
        continue;
      }
      const html = await res.text();
      const dates = src.extract(html);
      results.push({ key: src.key, name: src.name, url: src.url, dates });
    } catch (err) {
      results.push({ key: src.key, name: src.name, url: src.url, dates: [], error: err.message });
    }
  }
  return results;
}

export function diffPnp(provinces, lastSeen) {
  // lastSeen: { [key]: "<latest-iso-date>" }
  const prev = lastSeen ?? null;
  const next = { ...(prev ?? {}) };
  const fresh = [];
  let baseline = !prev;

  for (const province of provinces) {
    if (!province.dates.length) continue;
    const latest = province.dates[0]; // newest first
    const lastSeenForProv = prev?.[province.key];
    next[province.key] = latest;

    if (baseline) continue; // first run: just record
    if (!lastSeenForProv || latest > lastSeenForProv) {
      fresh.push({ ...province, draw: latest });
    }
  }

  return { fresh, next, baseline };
}

export function formatPnp(item) {
  return [
    `🍁 <b>${escape(item.name)} — New Draw</b>`,
    `🇰🇷 <i>${escape(item.name)} 새 추첨</i>`,
    `📅 ${item.draw}`,
    ``,
    `Check details at the link below.`,
    ``,
    `🔗 ${item.url}`,
  ].join("\n");
}

// ── Per-province extractors ────────────────────────────────────────
// Each returns ISO-format date strings (YYYY-MM-DD), newest-first.
// If parsing fails the function returns []; never throws.

function extractBcDates(html) {
  // BC has two surfaces:
  // 1. High Economic Impact draws as <h3><strong>Month D, YYYY</strong></h3>
  //    followed by a paragraph (the most-recent of these is what dispatch
  //    typically watches for).
  // 2. Skills Immigration table with columns Date | Stream | Minimum Score |
  //    Number of Invitations. Date cells can carry rowspan="2" when one
  //    draw produced both Base + Regional. The first <td> after each <tr>
  //    is the date when present; subsequent <tr> with rowspan>1 in effect
  //    inherits the prior date.
  // We collect dates from both surfaces, dedupe, and return newest-first.

  const headingMatches = [
    ...html.matchAll(/<h3[^>]*><strong[^>]*>([A-Z][a-z]+ \d{1,2},?\s*\d{4})<\/strong>/g),
  ].map((m) => parseLooseDate(m[1]));

  // Pull every date-shaped string from inside any <td>. The Skills
  // Immigration table's date column always renders a date in the cell;
  // headers / score columns never produce these strings, so we don't
  // need bespoke table-parsing.
  const tableMatches = [
    ...html.matchAll(/<td[^>]*>\s*([A-Z][a-z]+ \d{1,2},?\s*\d{4})/g),
  ].map((m) => parseLooseDate(m[1]));

  const all = [...headingMatches, ...tableMatches].filter(Boolean);
  return [...new Set(all)].sort().reverse();
}

function extractOntarioDates(html) {
  // Ontario publishes draws as <h3>Month D, YYYY</h3> followed by table.
  // The page can repeat dates (multiple streams on same date) so we dedupe.
  const matches = [
    ...html.matchAll(/<h3[^>]*>([A-Z][a-z]+ \d{1,2},?\s*\d{4})<\/h3>/g),
  ];
  const dates = matches.map((m) => parseLooseDate(m[1])).filter(Boolean);
  return [...new Set(dates)].sort().reverse();
}

function parseLooseDate(s) {
  // "April 22, 2026" → "2026-04-22". Parse manually to avoid local-vs-UTC
  // drift: Date.parse() on a date-only string returns local midnight, then
  // toISOString() converts back to UTC and shifts the date by one in
  // negative-offset zones. Manual parse keeps the date stable.
  const m = String(s)
    .trim()
    .match(/^([A-Z][a-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (!m) return null;
  const months = {
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
    July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
  };
  const month = months[m[1]];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function escape(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
