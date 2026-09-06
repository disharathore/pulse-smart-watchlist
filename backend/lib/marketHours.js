/**
 * Market Hours Utility for US Equities (NYSE / NASDAQ)
 *
 * Regular trading session: Monday - Friday, 9:30 AM to 4:00 PM US Eastern Time.
 * Note: Exchange holidays (e.g. Memorial Day, Labor Day, Thanksgiving) are
 * simplified as standard weekdays for simplicity in this implementation.
 */

export function getMarketStatus() {
  const now = new Date();

  // Convert current UTC time to US Eastern Time parts
  const easternFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = easternFormatter.formatToParts(now);
  const getPart = (type) => parts.find((p) => p.type === type)?.value;

  const weekday = getPart('weekday'); // "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const timeInMinutes = hour * 60 + minute;

  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const MARKET_OPEN_MINUTES = 9 * 60 + 30; // 09:30 AM ET
  const MARKET_CLOSE_MINUTES = 16 * 60;    // 04:00 PM ET

  let isOpen = false;
  let session = 'closed';
  let message = '';

  if (isWeekend) {
    isOpen = false;
    session = 'weekend';
    message = 'Markets closed · Reopens Monday at 9:30 AM ET';
  } else if (timeInMinutes < MARKET_OPEN_MINUTES) {
    isOpen = false;
    session = 'pre-market';
    message = 'Pre-market · Opens today at 9:30 AM ET';
  } else if (timeInMinutes >= MARKET_CLOSE_MINUTES) {
    isOpen = false;
    session = 'after-hours';
    const nextDay = weekday === 'Fri' ? 'Monday' : 'tomorrow';
    message = `After-hours · Opens ${nextDay} at 9:30 AM ET`;
  } else {
    isOpen = true;
    session = 'regular';
    message = 'Regular trading session · Closes at 4:00 PM ET';
  }

  return {
    isOpen,
    session,
    message,
    timezone: 'America/New_York',
    asOf: now.toISOString(),
  };
}
