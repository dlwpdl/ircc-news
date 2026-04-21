// Korean translation via Google Translate's unofficial gtx endpoint.
// No API key, free, but unofficial — can rate-limit if you blast it.
// Our volume is tiny (a few items per day) so it's fine.
//
// Each call returns { text: translated } or falls back to the original
// English on any error — we'd rather deliver the news late-translated
// than lose the alert.

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

export async function translateKo(text) {
  if (!text) return "";
  const trimmed = String(text).trim();
  if (!trimmed) return "";

  try {
    const url =
      `${ENDPOINT}?client=gtx&sl=en&tl=ko&dt=t&q=` +
      encodeURIComponent(trimmed);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (!res.ok) return trimmed;
    const data = await res.json();
    // Response shape: [[[ "translated", "original", ... ], ... ], ...]
    const segments = Array.isArray(data?.[0]) ? data[0] : [];
    return segments
      .map((s) => (Array.isArray(s) ? s[0] : ""))
      .join("")
      .trim() || trimmed;
  } catch {
    return trimmed;
  }
}
