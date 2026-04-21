// IRCC news/policy/draw watcher. One run = one check across all
// configured sources. Safe to run from cron / GitHub Actions / manually.
//
// Exit 0 on success (including no-change), non-zero on unexpected error.

import "dotenv/config";
import { readState, writeState, capSeen } from "./state.js";
import { sendTelegram, sendChunked } from "./telegram.js";
import {
  fetchExpressEntry,
  formatDraw,
  diffDraws,
} from "./sources/express-entry.js";
import { fetchNews, formatNews, diffNews } from "./sources/news.js";

async function run() {
  const state = await readState();
  let changed = false;
  let alerts = 0;

  // ── Express Entry ─────────────────────────────────────────────────
  try {
    const draws = await fetchExpressEntry();
    const prev = state.expressEntry?.lastDrawNumber ?? null;
    const { newDraws, baseline } = diffDraws(draws, prev);

    if (baseline !== null) {
      // First run — don't spam with every historical draw, just record.
      state.expressEntry = { lastDrawNumber: baseline };
      changed = true;
      console.log(`[EE] baseline set to draw #${baseline}`);
    } else if (newDraws.length) {
      // Send oldest→newest so Telegram thread reads chronologically.
      for (const d of newDraws.slice().reverse()) {
        await sendTelegram(formatDraw(d));
        alerts++;
      }
      state.expressEntry = { lastDrawNumber: newDraws[0].drawNumber };
      changed = true;
      console.log(`[EE] ${newDraws.length} new draw(s)`);
    } else {
      console.log("[EE] no changes");
    }
  } catch (err) {
    console.error("[EE] error:", err.message);
  }

  // ── IRCC News ─────────────────────────────────────────────────────
  try {
    const feed = await fetchNews();
    const seen = state.news?.seenIds;
    const { fresh, baseline } = diffNews(feed, seen);

    if (baseline) {
      // Seed with current 25; don't fire historical alerts.
      state.news = { seenIds: capSeen(feed.map((e) => e.id)) };
      changed = true;
      console.log(`[News] baseline set with ${feed.length} items`);
    } else if (fresh.length) {
      for (const item of fresh.slice().reverse()) {
        await sendChunked(formatNews(item));
        alerts++;
      }
      state.news = {
        seenIds: capSeen([...(seen || []), ...fresh.map((f) => f.id)]),
      };
      changed = true;
      console.log(`[News] ${fresh.length} new item(s)`);
    } else {
      console.log("[News] no changes");
    }
  } catch (err) {
    console.error("[News] error:", err.message);
  }

  if (changed) await writeState(state);
  console.log(`Done — ${alerts} alert(s) sent`);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
