import { supabase, getDemoUserId } from './supabaseClient.js';
import { getQuote } from './marketData.js';
import { scoreSymbol } from './scoring.js';
import { eventBus } from './events.js';
import { logger } from './logger.js';
import { getUserSettings } from './settingsStore.js';

let isRunning = false;

export function startWorker(intervalMs = 60000) {
  logger.info('worker', `Starting background price poller (every ${intervalMs / 1000}s)`);
  runOnce(); // run immediately on boot, then on the interval
  const handle = setInterval(runOnce, intervalMs);
  return handle;
}

async function runOnce() {
  if (isRunning) {
    logger.info('worker', 'Previous cycle still running — skipping this tick.');
    return;
  }
  isRunning = true;
  try {
    const { data: items, error } = await supabase
      .from('watchlist_items')
      .select('symbol');

    if (error) {
      logger.error('worker', 'Failed to load watched symbols:', error);
      return;
    }

    const symbols = [...new Set((items || []).map((i) => i.symbol))];
    if (symbols.length === 0) return;

    const cycleResults = [];

    for (const symbol of symbols) {
      const res = await processSymbol(symbol);
      if (res) cycleResults.push(res);
    }

    // Correlated-move detection (Part 3A)
    // Check if 3 or more symbols moved >1% in the same direction in this cycle
    const upMovers = cycleResults.filter((r) => r.pctChange != null && r.pctChange >= 1.0);
    const downMovers = cycleResults.filter((r) => r.pctChange != null && r.pctChange <= -1.0);

    if (upMovers.length >= 3 || downMovers.length >= 3) {
      const isUp = upMovers.length >= 3;
      const movers = isUp ? upMovers : downMovers;
      const directionWord = isUp ? 'surged' : 'dropped';
      const count = movers.length;

      logger.info('worker', `Correlated market move detected: ${count} symbols ${directionWord} >1%`);

      // Update change events from this cycle to flag broad market move
      for (const mover of movers) {
        if (mover.eventId) {
          const marker = `Part of a broader market move — ${count - 1} other symbols moved similarly.`;
          const updatedReason = mover.reasonText ? `${mover.reasonText} • ${marker}` : marker;

          await supabase
            .from('change_events')
            .update({ reason_text: updatedReason })
            .eq('id', mover.eventId);
        }
      }

      eventBus.emit('change', {
        type: 'correlated_move',
        direction: isUp ? 'up' : 'down',
        count,
        symbols: movers.map((m) => m.symbol),
        timestamp: new Date().toISOString(),
      });
    }

    // Broadcast poll cycle completion to SSE clients
    eventBus.emit('change', { type: 'poll_complete', timestamp: new Date().toISOString(), symbolCount: symbols.length });
  } catch (err) {
    logger.error('worker', 'Unexpected error during poll cycle:', err);
  } finally {
    isRunning = false;
  }
}

async function processSymbol(symbol) {
  try {
    const quote = await getQuote(symbol);
    if (quote.error || quote.price == null) {
      logger.warn('worker', `Skipping snapshot for ${symbol} — no valid quote.`);
      return null;
    }

    // Write the snapshot (append-only)
    const { error: snapErr } = await supabase.from('price_snapshots').insert([
      { symbol, price: quote.price, snapshot_at: new Date().toISOString(), source: 'finnhub' },
    ]);
    if (snapErr) logger.error('worker', `Failed to write snapshot for ${symbol}:`, snapErr);

    // Recompute score using recent history, and log a change_event if it's notable.
    const { data: history } = await supabase
      .from('price_snapshots')
      .select('price')
      .eq('symbol', symbol)
      .order('snapshot_at', { ascending: true })
      .limit(200);

    const prices = (history || []).map((h) => Number(h.price));
    const recentPctChanges = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1]) recentPctChanges.push(((prices[i] - prices[i - 1]) / prices[i - 1]) * 100);
    }

    const trackedHigh = prices.length ? Math.max(...prices) : null;
    const trackedLow = prices.length ? Math.min(...prices) : null;

    // Fetch the user's custom sensitivity thresholds so background scoring
    // respects the same settings as the on-screen /watchlist view.
    const userId = await getDemoUserId();
    const thresholds = await getUserSettings(userId);

    const { score, triage, reasons } = scoreSymbol(
      quote,
      recentPctChanges.slice(-30),
      trackedHigh,
      trackedLow,
      thresholds
    );

    let eventId = null;
    let reasonText = '';

    if (triage !== 'nothing_to_do' && reasons.length > 0) {
      reasonText = reasons.join(' • ');
      const { data: newEvent, error: eventErr } = await supabase.from('change_events').insert([
        {
          symbol,
          event_type: triage,
          magnitude: score,
          reason_text: reasonText,
          score,
          detected_at: new Date().toISOString(),
        },
      ]).select().single();

      if (eventErr) {
        logger.error('worker', `Failed to write change event for ${symbol}:`, eventErr);
      } else {
        eventId = newEvent?.id;
        // Broadcast specific change event (e.g. for browser notifications)
        eventBus.emit('change', {
          type: 'change_event',
          symbol,
          triage,
          score,
          reasons,
          event: newEvent,
        });
      }
    }

    // Back-fill accuracy outcomes for past events
    await evaluatePastEvents(symbol);

    return {
      symbol,
      pctChange: quote.pctChange,
      price: quote.price,
      score,
      triage,
      eventId,
      reasonText,
    };
  } catch (err) {
    logger.error('worker', `Failed processing ${symbol}:`, err.message);
    return null;
  }
}

async function evaluatePastEvents(symbol) {
  try {
    const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();

    const { data: unevaluated, error: qErr } = await supabase
      .from('change_events')
      .select('id, detected_at, score, event_type')
      .eq('symbol', symbol)
      .is('follow_through_pct', null)
      .lt('detected_at', cutoff)
      .order('detected_at', { ascending: true })
      .limit(20);

    if (qErr) {
      if (qErr.code !== '42703') {
        logger.error('worker', `evaluatePastEvents query error for ${symbol}:`, qErr);
      }
      return;
    }
    if (!unevaluated || unevaluated.length === 0) return;

    const { data: snapshots } = await supabase
      .from('price_snapshots')
      .select('price, snapshot_at')
      .eq('symbol', symbol)
      .order('snapshot_at', { ascending: true });

    if (!snapshots || snapshots.length < 4) return;

    for (const event of unevaluated) {
      const detectedAt = new Date(event.detected_at).getTime();

      const baseIdx = snapshots.findLastIndex(
        (s) => new Date(s.snapshot_at).getTime() <= detectedAt
      );
      if (baseIdx < 0 || baseIdx + 3 >= snapshots.length) continue;

      const basePrice = Number(snapshots[baseIdx].price);
      const futurePrice = Number(snapshots[baseIdx + 3].price);
      if (!basePrice) continue;

      const followThroughPct = ((futurePrice - basePrice) / basePrice) * 100;
      const wasSignificant = Math.abs(followThroughPct) >= 0.3;

      const { error: updateErr } = await supabase
        .from('change_events')
        .update({
          follow_through_pct: Number(followThroughPct.toFixed(4)),
          was_significant: wasSignificant,
        })
        .eq('id', event.id);

      if (updateErr) {
        logger.error('worker', `Failed to update event outcome ${event.id}:`, updateErr);
      }
    }
  } catch (err) {
    logger.error('worker', `evaluatePastEvents unexpected error for ${symbol}:`, err.message);
  }
}
