/**
 * The meaningful-change engine.
 *
 * Design note (worth restating in your pitch/demo): we don't have access to
 * true 52-week history or live trade volume on Finnhub's free tier, so
 * instead of faking that data, every signal here is computed from data we
 * actually have: the live quote, and OUR OWN accumulated snapshot history
 * since the user started tracking a symbol. This is an explicit, defensible
 * scoping decision, not an oversight — and it's a more honest system than
 * one that silently mocks numbers it doesn't really have.
 *
 * Signals used:
 *  1. Move size, weighted by how unusual it is vs. that stock's own recent
 *     volatility (a z-score, not a raw percentage).
 *  2. Position within today's high/low range (near a daily high/low is
 *     more attention-worthy than sitting mid-range).
 *  3. New high/low since we started tracking the symbol.
 */

const TRIAGE = {
  NEEDS_DECISION: 'needs_decision',
  WORTH_A_LOOK: 'worth_a_look',
  NOTHING_TO_DO: 'nothing_to_do',
};

export { TRIAGE };

function stdDev(values) {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * @param {object} quote - current quote from marketData.getQuote()
 * @param {number[]} recentPctChanges - pct changes from recent stored snapshots, most recent last
 * @param {number|null} trackedHigh - highest price seen since tracking started
 * @param {number|null} trackedLow - lowest price seen since tracking started
 * @param {object} thresholds - configurable sensitivity thresholds { needsDecision: number, worthALook: number }
 */
export function scoreSymbol(
  quote,
  recentPctChanges = [],
  trackedHigh = null,
  trackedLow = null,
  thresholds = { needsDecision: 55, worthALook: 25 }
) {
  if (!quote || quote.price == null || quote.prevClose == null) {
    return {
      score: 0,
      triage: TRIAGE.NOTHING_TO_DO,
      reasons: [],
      pctChange: null,
      confidence: 'low',
    };
  }

  const pctChange = ((quote.price - quote.prevClose) / quote.prevClose) * 100;
  const reasons = [];
  let score = 0;

  // Signal 1: move size vs. this stock's own recent volatility (z-score)
  const sd = stdDev(recentPctChanges);
  if (sd && sd > 0.01) {
    const z = Math.abs(pctChange) / sd;
    const moveScore = Math.min(z * 20, 55); // cap contribution
    score += moveScore;
    if (z >= 2) {
      reasons.push(
        `${pctChange >= 0 ? 'Up' : 'Down'} ${Math.abs(pctChange).toFixed(1)}% — unusually large move for this stock`
      );
    } else if (Math.abs(pctChange) >= 1.5) {
      reasons.push(`${pctChange >= 0 ? 'Up' : 'Down'} ${Math.abs(pctChange).toFixed(1)}% today`);
    }
  } else if (Math.abs(pctChange) >= 1.5) {
    // Not enough history yet to compute volatility — fall back to raw magnitude.
    score += Math.min(Math.abs(pctChange) * 8, 40);
    reasons.push(`${pctChange >= 0 ? 'Up' : 'Down'} ${Math.abs(pctChange).toFixed(1)}% today`);
  }

  // Signal 2: position within today's range
  if (quote.high != null && quote.low != null && quote.high !== quote.low) {
    const rangePct = ((quote.price - quote.low) / (quote.high - quote.low)) * 100;
    if (rangePct >= 95) {
      score += 20;
      reasons.push('Trading at today\u2019s high');
    } else if (rangePct <= 5) {
      score += 20;
      reasons.push('Trading at today\u2019s low');
    }
  }

  // Signal 3: new high/low since tracking started
  if (trackedHigh != null && quote.price > trackedHigh) {
    score += 25;
    reasons.push('New high since you added it to your watchlist');
  } else if (trackedLow != null && quote.price < trackedLow) {
    score += 25;
    reasons.push('New low since you added it to your watchlist');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  // Dynamic sensitivity thresholds with standard defaults
  const ndThreshold = thresholds?.needsDecision ?? 55;
  const walThreshold = thresholds?.worthALook ?? 25;

  let triage = TRIAGE.NOTHING_TO_DO;
  if (score >= ndThreshold) triage = TRIAGE.NEEDS_DECISION;
  else if (score >= walThreshold) triage = TRIAGE.WORTH_A_LOOK;

  // Confidence reflects how reliable the volatility-weighted signal is.
  // < 5 data points: stdDev is meaningless, raw magnitude fallback used.
  // 5–19 points: some baseline, but limited sample.
  // 20+: robust enough to trust the z-score fully.
  const confidence =
    recentPctChanges.length >= 20 ? 'high' :
    recentPctChanges.length >= 5  ? 'medium' : 'low';

  return { score, triage, reasons, pctChange: Number(pctChange.toFixed(2)), confidence };
}
