import { supabase } from './supabaseClient.js';
import { logger } from './logger.js';

// In-memory fallback if user_settings table has not yet been migrated in Supabase
const inMemorySettings = new Map();

export async function getUserSettings(userId) {
  if (inMemorySettings.has(userId)) {
    return inMemorySettings.get(userId);
  }

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('needs_decision_threshold, worth_a_look_threshold')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (error.code !== '42P01' && error.code !== 'PGRST205') {
        logger.error('settings', 'Failed to fetch settings from supabase:', error);
      }
      return { needsDecision: 55, worthALook: 25 };
    }

    if (!data) {
      return { needsDecision: 55, worthALook: 25 };
    }

    const settings = {
      needsDecision: Number(data.needs_decision_threshold ?? 55),
      worthALook: Number(data.worth_a_look_threshold ?? 25),
    };
    inMemorySettings.set(userId, settings);
    return settings;
  } catch (err) {
    logger.error('settings', 'Unexpected error fetching settings:', err.message);
    return { needsDecision: 55, worthALook: 25 };
  }
}

/**
 * Update the in-memory settings cache. Called by the settings route
 * after a successful save so the worker picks up changes immediately.
 */
export function setCachedSettings(userId, settings) {
  inMemorySettings.set(userId, settings);
}
