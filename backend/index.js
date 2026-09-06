import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { router as watchlistRouter } from './routes/watchlist.js';
import { router as stocksRouter } from './routes/stocks.js';
import { router as settingsRouter } from './routes/settings.js';
import { startWorker } from './lib/worker.js';
import { logger } from './lib/logger.js';
import { getMarketStatus } from './lib/marketHours.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Structured request logging
app.use((req, res, next) => {
  // Avoid noisy logging of long-lived SSE connections and polling
  if (req.path !== '/watchlist/stream') {
    logger.info('http', `${req.method} ${req.path}`);
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), market: getMarketStatus() });
});

app.get('/market-status', (req, res) => {
  res.json(getMarketStatus());
});

app.use('/watchlist', watchlistRouter);
app.use('/stocks', stocksRouter);
app.use('/settings', settingsRouter);

// Catch-all error handler
app.use((err, req, res, next) => {
  logger.error('unhandled', err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const server = app.listen(PORT, () => {
  logger.info('server', `Backend running on http://localhost:${PORT}`);
});

const workerHandle = startWorker(Number(process.env.POLL_INTERVAL_MS) || 60000);

function shutdown() {
  logger.info('server', 'Shutting down gracefully…');
  clearInterval(workerHandle);
  server.close(() => {
    logger.info('server', 'Closed. Bye!');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
