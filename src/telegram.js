// Minimal Telegram sender. Uses Bot API sendMessage. If DRY_RUN=1, logs
// to console instead — safer when testing a new data source.

const API = "https://api.telegram.org";

export async function sendTelegram(text, { parseMode = "HTML", disablePreview = true } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (process.env.DRY_RUN === "1") {
    console.log("[DRY_RUN]", text.slice(0, 500));
    return { ok: true, dryRun: true };
  }

  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required");
  }

  const res = await fetch(`${API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: disablePreview,
    }),
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(`Telegram error: ${json.description || res.status}`);
  }
  return json;
}

// Chunk long messages to stay under Telegram's 4096-char limit.
export async function sendChunked(text, opts) {
  const MAX = 3800;
  if (text.length <= MAX) return sendTelegram(text, opts);
  const chunks = [];
  let remaining = text;
  while (remaining.length) {
    let cut = Math.min(MAX, remaining.length);
    if (cut < remaining.length) {
      const nl = remaining.lastIndexOf("\n", cut);
      if (nl > MAX * 0.5) cut = nl;
    }
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  for (const c of chunks) await sendTelegram(c, opts);
  return { ok: true, chunks: chunks.length };
}

export function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
