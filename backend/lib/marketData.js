import NodeCache from 'node-cache';
import dotenv from 'dotenv';
import { logger } from './logger.js';

dotenv.config();

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

// Cache quotes for 20s default. This protects the free-tier rate limit.
const quoteCache = new NodeCache({ stdTTL: 20 });

// Rate-limit & exponential backoff tracking
const backoffState = new Map(); // symbol -> { failureCount, backoffUntil }

const BASE_BACKOFF_SEC = 60;
const MAX_BACKOFF_SEC = 300;

/**
 * Fetches a live quote for a symbol from Finnhub.
 * Returns { price, prevClose, high, low, open, stale, fetchedAt }.
 * Never throws — on any failure it returns the last cached value (marked
 * stale) or a null-price object, so a single flaky API call can never crash
 * a request that's aggregating many symbols.
 *
 * Implements exponential backoff on HTTP 429 or sustained network failures.
 */
export async function getQuote(symbol) {
  const cacheKey = `quote:${symbol}`;
  const cached = quoteCache.get(cacheKey);
  if (cached) return { ...cached, stale: false };

  // Check if symbol is in exponential backoff
  const now = Date.now();
  const backoff = backoffState.get(symbol);
  if (backoff && now < backoff.backoffUntil) {
    const remainingSec = Math.ceil((backoff.backoffUntil - now) / 1000);
    logger.warn('marketData', `[backoff] ${symbol} rate-limited, serving cached/stale (${remainingSec}s remaining)`);
    return nullQuote(symbol, cached);
  }

  if (!FINNHUB_KEY) {
    logger.warn('marketData', `FINNHUB_API_KEY not set — returning null quote for ${symbol}`);
    return nullQuote(symbol, cached);
  }

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`
    );

    if (res.status === 429) {
      const prevFailures = backoff?.failureCount || 0;
      const nextFailures = prevFailures + 1;
      const backoffSec = Math.min(BASE_BACKOFF_SEC * Math.pow(2, prevFailures), MAX_BACKOFF_SEC);
      const backoffUntil = now + backoffSec * 1000;

      backoffState.set(symbol, { failureCount: nextFailures, backoffUntil });
      logger.warn(
        'marketData',
        `Finnhub 429 Rate Limit for ${symbol}. Backing off for ${backoffSec}s (strike ${nextFailures})`
      );

      // Cache stale data for the duration of the backoff to avoid hammering Finnhub
      if (cached) quoteCache.set(cacheKey, cached, backoffSec);
      return nullQuote(symbol, cached);
    }

    if (!res.ok) {
      const prevFailures = backoff?.failureCount || 0;
      const nextFailures = prevFailures + 1;
      if (nextFailures >= 3) {
        const backoffSec = BASE_BACKOFF_SEC;
        backoffState.set(symbol, { failureCount: nextFailures, backoffUntil: now + backoffSec * 1000 });
      } else {
        backoffState.set(symbol, { failureCount: nextFailures, backoffUntil: 0 });
      }
      logger.error('marketData', `Finnhub responded ${res.status} for ${symbol}`);
      return nullQuote(symbol, cached);
    }

    const data = await res.json();

    // Finnhub returns all-zero fields for an unknown/invalid symbol instead
    // of an HTTP error, so we treat that case explicitly.
    if (!data || (data.c === 0 && data.pc === 0)) {
      logger.warn('marketData', `No data returned for symbol "${symbol}" — likely invalid.`);
      return nullQuote(symbol, cached);
    }

    // Success — reset backoff tracking for this symbol
    if (backoffState.has(symbol)) {
      backoffState.delete(symbol);
    }

    const quote = {
      price: data.c,
      prevClose: data.pc,
      high: data.h,
      low: data.l,
      open: data.o,
      fetchedAt: new Date().toISOString(),
    };

    quoteCache.set(cacheKey, quote);
    return { ...quote, stale: false };
  } catch (err) {
    logger.error('marketData', `Failed to fetch quote for ${symbol}:`, err.message);
    return nullQuote(symbol, cached);
  }
}

function nullQuote(symbol, staleCache) {
  if (staleCache) {
    return { ...staleCache, stale: true };
  }
  return {
    price: null,
    prevClose: null,
    high: null,
    low: null,
    open: null,
    fetchedAt: null,
    stale: true,
    error: true,
  };
}

// ─── Company Profile (Sector / Name) ──────────────────────
const profileCache = new NodeCache({ stdTTL: 86400 }); // 24 hours

export async function getCompanyProfile(symbol) {
  const cacheKey = `profile:${symbol}`;
  const cached = profileCache.get(cacheKey);
  if (cached) return cached;

  if (!FINNHUB_KEY) {
    return { name: symbol, industry: 'Equities', logo: null };
  }

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) {
      return { name: symbol, industry: 'Equities', logo: null };
    }
    const data = await res.json();
    const profile = {
      name: data.name || symbol,
      industry: data.finnhubIndustry || 'Equities',
      logo: data.logo || null,
      weburl: data.weburl || null,
    };
    profileCache.set(cacheKey, profile);
    return profile;
  } catch (err) {
    logger.error('marketData', `Failed to fetch profile for ${symbol}:`, err.message);
    return { name: symbol, industry: 'Equities', logo: null };
  }
}

// ─── Company News ──────────────────────────────────────────
const newsCache = new NodeCache({ stdTTL: 900 }); // 15 minutes

export async function getCompanyNews(symbol, days = 5) {
  const cacheKey = `news:${symbol}`;
  const cached = newsCache.get(cacheKey);
  if (cached) return cached;

  if (!FINNHUB_KEY) return [];

  try {
    const to = new Date().toISOString().slice(0, 10);
    const fromDate = new Date(Date.now() - days * 86400000);
    const from = fromDate.toISOString().slice(0, 10);

    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const news = data
      .filter((n) => n.headline && n.headline.trim())
      .slice(0, 6)
      .map((n) => ({
        id: n.id,
        headline: n.headline,
        source: n.source,
        url: n.url,
        datetime: n.datetime,
        summary: n.summary,
        image: n.image,
      }));

    newsCache.set(cacheKey, news);
    return news;
  } catch (err) {
    logger.error('marketData', `Failed to fetch news for ${symbol}:`, err.message);
    return [];
  }
}

