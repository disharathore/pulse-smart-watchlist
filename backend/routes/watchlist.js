import express from 'express';
import { supabase, getDemoUserId } from '../lib/supabaseClient.js';
import { getQuote, getCompanyProfile, getCompanyNews } from '../lib/marketData.js';
import { scoreSymbol } from '../lib/scoring.js';
import { eventBus } from '../lib/events.js';
import { logger } from '../lib/logger.js';
import { getUserSettings } from '../lib/settingsStore.js';

export const router = express.Router();

// SSE active clients
const sseClients = new Set();

// Recent snapshot history, used to compute volatility and tracked high/low.
async function getSymbolContext(symbol) {
  const { data: history, error } = await supabase
    .from('price_snapshots')
    .select('price, snapshot_at')
    .eq('symbol', symbol)
    .order('snapshot_at', { ascending: true })
    .limit(200);

  if (error) {
    logger.error('watchlist', `Failed to load history for ${symbol}:`, error);
    return { recentPctChanges: [], trackedHigh: null, trackedLow: null };
  }

  if (!history || history.length < 2) {
    return { recentPctChanges: [], trackedHigh: null, trackedLow: null };
  }

  const prices = history.map((h) => Number(h.price));
  const recentPctChanges = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    if (prev) recentPctChanges.push(((prices[i] - prev) / prev) * 100);
  }

  return {
    recentPctChanges: recentPctChanges.slice(-30), // last 30 data points
    trackedHigh: Math.max(...prices),
    trackedLow: Math.min(...prices),
  };
}

async function buildEnrichedItem(item, thresholds) {
  const [quote, context, profile, news] = await Promise.all([
    getQuote(item.symbol),
    getSymbolContext(item.symbol),
    getCompanyProfile(item.symbol),
    getCompanyNews(item.symbol, 3),
  ]);

  const { score, triage, reasons, pctChange, confidence } = scoreSymbol(
    quote,
    context.recentPctChanges,
    context.trackedHigh,
    context.trackedLow,
    thresholds
  );

  const topNews = news && news.length > 0 ? news[0] : null;

  return {
    id: item.id,
    symbol: item.symbol,
    companyName: profile?.name || item.symbol,
    sector: profile?.industry || 'Equities',
    logo: profile?.logo || null,
    addedAt: item.added_at,
    price: quote.price,
    prevClose: quote.prevClose,
    pctChange,
    stale: quote.stale,
    dataError: !!quote.error,
    score,
    triage,
    reasons,
    confidence,
    topNews: topNews
      ? {
          headline: topNews.headline,
          source: topNews.source,
          url: topNews.url,
          datetime: topNews.datetime,
        }
      : null,
  };
}

// GET /watchlist/stream — Server-Sent Events (SSE) real-time push connection
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Confirm connection
  res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);

  const client = { res };
  sseClients.add(client);
  logger.info('sse', `Client connected to /watchlist/stream (active clients: ${sseClients.size})`);

  // Heartbeat ping every 25s to keep proxy/connections open
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(client);
    logger.info('sse', `Client disconnected from /watchlist/stream (active clients: ${sseClients.size})`);
  });
});

// Broadcast events from eventBus to all connected SSE clients
eventBus.on('change', (payload) => {
  if (sseClients.size === 0) return;
  const message = `data: ${JSON.stringify(payload || { type: 'update' })}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(message);
    } catch (err) {
      logger.error('sse', 'Error writing to SSE client:', err.message);
    }
  }
});

// GET /watchlist — full list with live prices + scores attached
router.get('/', async (req, res) => {
  try {
    const userId = await getDemoUserId();
    const thresholds = await getUserSettings(userId);

    const { data: items, error } = await supabase
      .from('watchlist_items')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (error) {
      logger.error('watchlist', 'GET / supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    const enriched = await Promise.all((items || []).map((i) => buildEnrichedItem(i, thresholds)));
    res.json(enriched);
  } catch (err) {
    logger.error('watchlist', 'GET / unexpected error:', err);
    res.status(500).json({ error: 'Failed to load watchlist. Check backend logs.' });
  }
});

// GET /watchlist/catchup — same data, ranked by score, grouped by triage
router.get('/catchup', async (req, res) => {
  try {
    const userId = await getDemoUserId();
    const thresholds = await getUserSettings(userId);

    const { data: items, error } = await supabase
      .from('watchlist_items')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      logger.error('watchlist', 'GET /catchup supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    const enriched = await Promise.all((items || []).map((i) => buildEnrichedItem(i, thresholds)));
    enriched.sort((a, b) => b.score - a.score);

    res.json({
      needsDecision: enriched.filter((i) => i.triage === 'needs_decision'),
      worthALook: enriched.filter((i) => i.triage === 'worth_a_look'),
      nothingToDo: enriched.filter((i) => i.triage === 'nothing_to_do'),
    });
  } catch (err) {
    logger.error('watchlist', 'GET /catchup unexpected error:', err);
    res.status(500).json({ error: 'Failed to load catch-up. Check backend logs.' });
  }
});

const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,10}$/;

// GET /watchlist/stats — portfolio-level summary
router.get('/stats', async (req, res) => {
  try {
    const userId = await getDemoUserId();
    const thresholds = await getUserSettings(userId);

    const { data: items, error } = await supabase
      .from('watchlist_items')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      logger.error('watchlist', 'GET /stats supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    const enriched = await Promise.all((items || []).map((i) => buildEnrichedItem(i, thresholds)));
    const withChange = enriched.filter((i) => i.pctChange != null);

    const avgChange = withChange.length
      ? withChange.reduce((sum, i) => sum + i.pctChange, 0) / withChange.length
      : 0;

    const biggestMover = withChange.length
      ? withChange.reduce((max, i) => (Math.abs(i.pctChange) > Math.abs(max.pctChange) ? i : max))
      : null;

    res.json({
      totalSymbols: enriched.length,
      needsDecisionCount: enriched.filter((i) => i.triage === 'needs_decision').length,
      worthALookCount: enriched.filter((i) => i.triage === 'worth_a_look').length,
      avgChange: Number(avgChange.toFixed(2)),
      biggestMover: biggestMover
        ? { symbol: biggestMover.symbol, pctChange: biggestMover.pctChange }
        : null,
    });
  } catch (err) {
    logger.error('watchlist', 'GET /stats unexpected error:', err);
    res.status(500).json({ error: 'Failed to load stats. Check backend logs.' });
  }
});

// GET /watchlist/accuracy — aggregate signal accuracy stats
router.get('/accuracy', async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('change_events')
      .select('event_type, was_significant')
      .not('follow_through_pct', 'is', null);

    if (error) {
      if (error.code === '42703') {
        return res.json({
          totalEvaluated: 0,
          significantCount: 0,
          accuracyPct: null,
          byTriage: {},
          note: 'Schema migration pending: run alter table statements in schema.sql',
        });
      }
      logger.error('watchlist', 'GET /accuracy supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!events || events.length === 0) {
      return res.json({
        totalEvaluated: 0,
        significantCount: 0,
        accuracyPct: null,
        byTriage: {},
        note: 'No evaluated events yet — accuracy builds up over time as the worker back-fills outcomes.',
      });
    }

    const significant = events.filter((e) => e.was_significant);

    const byTriage = {};
    for (const e of events) {
      if (!byTriage[e.event_type]) byTriage[e.event_type] = { total: 0, significant: 0, pct: null };
      byTriage[e.event_type].total++;
      if (e.was_significant) byTriage[e.event_type].significant++;
    }
    for (const key of Object.keys(byTriage)) {
      const g = byTriage[key];
      g.pct = g.total > 0 ? Number(((g.significant / g.total) * 100).toFixed(1)) : null;
    }

    res.json({
      totalEvaluated: events.length,
      significantCount: significant.length,
      accuracyPct: Number(((significant.length / events.length) * 100).toFixed(1)),
      byTriage,
    });
  } catch (err) {
    logger.error('watchlist', 'GET /accuracy unexpected error:', err);
    res.status(500).json({ error: 'Failed to load accuracy stats. Check backend logs.' });
  }
});

// GET /watchlist/export — CSV download
router.get('/export', async (req, res) => {
  try {
    const userId = await getDemoUserId();
    const thresholds = await getUserSettings(userId);

    const { data: items, error } = await supabase
      .from('watchlist_items')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (error) {
      logger.error('watchlist', 'GET /export supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    const enriched = await Promise.all((items || []).map((i) => buildEnrichedItem(i, thresholds)));

    const headers = ['Symbol', 'Price', 'PrevClose', 'PctChange', 'Score', 'Triage', 'Confidence', 'Stale', 'AddedAt'];
    const rows = enriched.map((i) => [
      i.symbol,
      i.price != null ? i.price.toFixed(2) : '',
      i.prevClose != null ? i.prevClose.toFixed(2) : '',
      i.pctChange != null ? i.pctChange.toFixed(2) : '',
      i.score,
      i.triage,
      i.confidence,
      i.stale ? 'true' : 'false',
      i.addedAt,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="pulse-watchlist-${timestamp}.csv"`);
    res.send(csv);
  } catch (err) {
    logger.error('watchlist', 'GET /export unexpected error:', err);
    res.status(500).json({ error: 'Failed to export watchlist. Check backend logs.' });
  }
});

// POST /watchlist/items — add a symbol
router.post('/items', async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol || typeof symbol !== 'string' || !symbol.trim()) {
      return res.status(400).json({ error: 'A valid symbol is required.' });
    }

    const cleanSymbol = symbol.trim().toUpperCase();

    if (!SYMBOL_PATTERN.test(cleanSymbol)) {
      return res.status(400).json({
        error: `"${cleanSymbol}" doesn't look like a valid ticker symbol.`,
      });
    }

    const userId = await getDemoUserId();
    const thresholds = await getUserSettings(userId);

    // Verify the symbol actually resolves before saving it.
    const quote = await getQuote(cleanSymbol);
    if (quote.error) {
      return res.status(400).json({
        error: `Couldn't find market data for "${cleanSymbol}". Check the symbol and try again.`,
      });
    }

    const { data, error } = await supabase
      .from('watchlist_items')
      .insert([{ symbol: cleanSymbol, user_id: userId }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `${cleanSymbol} is already on your watchlist.` });
      }
      logger.error('watchlist', 'POST /items supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Write an initial snapshot immediately so history/sparkline has a starting point.
    await supabase.from('price_snapshots').insert([
      { symbol: cleanSymbol, price: quote.price, snapshot_at: new Date().toISOString(), source: 'finnhub' },
    ]);

    const enriched = await buildEnrichedItem(data, thresholds);

    // Broadcast mutation to active SSE clients
    eventBus.emit('change', { type: 'item_added', symbol: cleanSymbol, item: enriched });

    res.status(201).json(enriched);
  } catch (err) {
    logger.error('watchlist', 'POST /items unexpected error:', err);
    res.status(500).json({ error: 'Failed to add symbol. Check backend logs.' });
  }
});

// DELETE /watchlist/items/:symbol
router.delete('/items/:symbol', async (req, res) => {
  try {
    const userId = await getDemoUserId();
    const symbol = req.params.symbol.toUpperCase();

    const { error } = await supabase
      .from('watchlist_items')
      .delete()
      .eq('symbol', symbol)
      .eq('user_id', userId);

    if (error) {
      logger.error('watchlist', 'DELETE supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Broadcast mutation to active SSE clients
    eventBus.emit('change', { type: 'item_removed', symbol });

    res.json({ deleted: true, symbol });
  } catch (err) {
    logger.error('watchlist', 'DELETE unexpected error:', err);
    res.status(500).json({ error: 'Failed to remove symbol. Check backend logs.' });
  }
});

// POST /watchlist/seen — mark a symbol (or all) as seen now
router.post('/seen', async (req, res) => {
  try {
    const userId = await getDemoUserId();
    const { symbol } = req.body;

    if (symbol) {
      await supabase
        .from('user_last_seen')
        .upsert([{ user_id: userId, symbol: symbol.toUpperCase(), last_seen_at: new Date().toISOString() }]);
    } else {
      const { data: items } = await supabase
        .from('watchlist_items')
        .select('symbol')
        .eq('user_id', userId);

      const rows = (items || []).map((i) => ({
        user_id: userId,
        symbol: i.symbol,
        last_seen_at: new Date().toISOString(),
      }));

      if (rows.length) await supabase.from('user_last_seen').upsert(rows);
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error('watchlist', 'POST /seen unexpected error:', err);
    res.status(500).json({ error: 'Failed to update last-seen. Check backend logs.' });
  }
});
