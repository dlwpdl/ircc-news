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
import {
  fetchCicNews,
  formatCicNews,
  diffCicNews,
} from "./sources/cic-news.js";
import {
  fetchParliament,
  formatParliament,
  diffParliament,
} from "./sources/parliament.js";
import {
  fetchProcessingTimesHash,
  diffProcessingTimes,
  formatProcessingTimes,
} from "./sources/processing-times.js";
import { fetchPnp, diffPnp, formatPnp } from "./sources/pnp.js";

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
      state.expressEntry = { lastDrawNumber: baseline };
      changed = true;
      console.log(`[EE] baseline set to draw #${baseline}`);
    } else if (newDraws.length) {
      for (const d of newDraws.slice().reverse()) {
        await sendTelegram(await formatDraw(d));
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

  // ── IRCC News (official press releases) ───────────────────────────
  try {
    const feed = await fetchNews();
    const seen = state.news?.seenIds;
    const { fresh, baseline } = diffNews(feed, seen);

    if (baseline) {
      state.news = { seenIds: capSeen(feed.map((e) => e.id)) };
      changed = true;
      console.log(`[News] baseline set with ${feed.length} items`);
    } else if (fresh.length) {
      for (const item of fresh.slice().reverse()) {
        await sendChunked(await formatNews(item));
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

  // ── CIC News (third-party scoops) ─────────────────────────────────
  try {
    const items = await fetchCicNews();
    const seen = state.cicNews?.seenIds;
    const { fresh, baseline } = diffCicNews(items, seen);

    if (baseline) {
      state.cicNews = { seenIds: capSeen(items.map((i) => i.id)) };
      changed = true;
      console.log(`[CIC] baseline set with ${items.length} items`);
    } else if (fresh.length) {
      for (const item of fresh.slice().reverse()) {
        await sendChunked(await formatCicNews(item));
        alerts++;
      }
      state.cicNews = {
        seenIds: capSeen([...(seen || []), ...fresh.map((f) => f.id)]),
      };
      changed = true;
      console.log(`[CIC] ${fresh.length} new item(s)`);
    } else {
      console.log("[CIC] no changes");
    }
  } catch (err) {
    console.error("[CIC] error:", err.message);
  }

  // ── Parliament (immigration-related bills) ────────────────────────
  try {
    const bills = await fetchParliament();
    const lastSeen = state.parliament?.signatures;
    const { changed: changedBills, next, baseline } = diffParliament(bills, lastSeen);

    if (baseline) {
      state.parliament = { signatures: next };
      changed = true;
      console.log(`[Parl] baseline set with ${Object.keys(next).length} bills`);
    } else if (changedBills.length) {
      for (const bill of changedBills) {
        await sendTelegram(formatParliament(bill));
        alerts++;
      }
      state.parliament = { signatures: next };
      changed = true;
      console.log(`[Parl] ${changedBills.length} bill change(s)`);
    } else {
      console.log("[Parl] no changes");
    }
  } catch (err) {
    console.error("[Parl] error:", err.message);
  }

  // ── Processing times (page-update detector) ───────────────────────
  try {
    const hash = await fetchProcessingTimesHash();
    const lastHash = state.processingTimes?.lastHash;
    const { changed: ptChanged, baseline } = diffProcessingTimes(hash, lastHash);

    if (baseline) {
      state.processingTimes = { lastHash: hash };
      changed = true;
      console.log("[PT] baseline hash recorded");
    } else if (ptChanged) {
      await sendTelegram(formatProcessingTimes());
      alerts++;
      state.processingTimes = { lastHash: hash };
      changed = true;
      console.log("[PT] page changed");
    } else {
      console.log("[PT] no changes");
    }
  } catch (err) {
    console.error("[PT] error:", err.message);
  }

  // ── PNP draws (BC + Ontario) ──────────────────────────────────────
  try {
    const provinces = await fetchPnp();
    const lastSeen = state.pnp?.latest;
    const { fresh, next, baseline } = diffPnp(provinces, lastSeen);

    if (baseline) {
      state.pnp = { latest: next };
      changed = true;
      const total = Object.keys(next).length;
      console.log(`[PNP] baseline set across ${total} province(s)`);
    } else if (fresh.length) {
      for (const item of fresh) {
        await sendTelegram(formatPnp(item));
        alerts++;
      }
      state.pnp = { latest: next };
      changed = true;
      console.log(`[PNP] ${fresh.length} province(s) had a new draw`);
    } else {
      console.log("[PNP] no changes");
    }
  } catch (err) {
    console.error("[PNP] error:", err.message);
  }

  if (changed) await writeState(state);
  console.log(`Done — ${alerts} alert(s) sent`);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
