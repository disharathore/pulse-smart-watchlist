import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { getQuote, getCompanyNews, getCompanyProfile } from '../lib/marketData.js';

export const router = express.Router();

// GET /stocks/:symbol/history — snapshot history for sparkline/detail chart
router.get('/:symbol/history', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const { data, error } = await supabase
      .from('price_snapshots')
      .select('price, snapshot_at')
      .eq('symbol', symbol)
      .order('snapshot_at', { ascending: true })
      .limit(500);

    if (error) {
      console.error('[stocks] history supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    const { data: events } = await supabase
      .from('change_events')
      .select('*')
      .eq('symbol', symbol)
      .order('detected_at', { ascending: false })
      .limit(20);

    const quote = await getQuote(symbol);

    res.json({
      symbol,
      history: data || [],
      events: events || [],
      prevClose: quote?.prevClose ?? null,
      open: quote?.open ?? null,
      currentPrice: quote?.price ?? null,
    });
  } catch (err) {
    console.error('[stocks] history unexpected error:', err);
    res.status(500).json({ error: 'Failed to load history. Check backend logs.' });
  }
});

// GET /stocks/:symbol/quote — a single live quote, useful for quick checks
router.get('/:symbol/quote', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const quote = await getQuote(symbol);
  res.json({ symbol, ...quote });
});

// GET /stocks/:symbol/news — company news articles
router.get('/:symbol/news', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const news = await getCompanyNews(symbol, 5);
    res.json({ symbol, news });
  } catch (err) {
    console.error('[stocks] news error:', err);
    res.status(500).json({ error: 'Failed to load news' });
  }
});

// GET /stocks/:symbol/profile — company profile
router.get('/:symbol/profile', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const profile = await getCompanyProfile(symbol);
    res.json({ symbol, ...profile });
  } catch (err) {
    console.error('[stocks] profile error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

