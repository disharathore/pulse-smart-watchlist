import express from 'express';
import { supabase, getDemoUserId } from '../lib/supabaseClient.js';
import { eventBus } from '../lib/events.js';
import { logger } from '../lib/logger.js';
import { getUserSettings, setCachedSettings } from '../lib/settingsStore.js';

export const router = express.Router();

// Re-export for any existing consumers
export { getUserSettings };

// GET /settings
router.get('/', async (req, res) => {
  try {
    const userId = await getDemoUserId();
    const settings = await getUserSettings(userId);
    res.json(settings);
  } catch (err) {
    logger.error('settings', 'GET / error:', err);
    res.status(500).json({ error: 'Failed to retrieve settings.' });
  }
});

// POST /settings
router.post('/', async (req, res) => {
  try {
    const userId = await getDemoUserId();
    const { needsDecision, worthALook } = req.body;

    const nd = Number(needsDecision);
    const wal = Number(worthALook);

    if (isNaN(nd) || isNaN(wal) || nd <= wal || nd > 100 || wal < 0) {
      return res.status(400).json({
        error: 'Invalid thresholds. Needs Decision must be greater than Worth a Look (within 0-100).',
      });
    }

    const newSettings = { needsDecision: nd, worthALook: wal };
    setCachedSettings(userId, newSettings);

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        needs_decision_threshold: nd,
        worth_a_look_threshold: wal,
        updated_at: new Date().toISOString(),
      });

    if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
      logger.error('settings', 'Error persisting settings to supabase:', error);
    }

    logger.info('settings', `Thresholds updated: NeedsDecision=${nd}, WorthALook=${wal}`);

    // Broadcast change to SSE clients so all active UI views re-triage immediately
    eventBus.emit('change', { type: 'settings', settings: newSettings });

    res.json(newSettings);
  } catch (err) {
    logger.error('settings', 'POST / error:', err);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});
