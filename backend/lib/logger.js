/**
 * In-house structured logger for Pulse backend.
 * Formats: [YYYY-MM-DDTHH:mm:ss.sssZ] [module] message
 */

function format(tag, ...args) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${tag}]`;
  return [prefix, ...args];
}

export const logger = {
  info(tag, ...args) {
    console.log(...format(tag, ...args));
  },
  warn(tag, ...args) {
    console.warn(...format(tag, ...args));
  },
  error(tag, ...args) {
    console.error(...format(tag, ...args));
  },
  debug(tag, ...args) {
    if (process.env.DEBUG) {
      console.debug(...format(tag, ...args));
    }
  },
};
