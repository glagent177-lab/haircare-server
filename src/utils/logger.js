const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info

function timestamp() {
  return new Date().toISOString()
}

export const logger = {
  debug: (...args) => {
    if (CURRENT_LEVEL <= LOG_LEVELS.debug) console.debug(`[${timestamp()}] [DEBUG]`, ...args)
  },
  info: (...args) => {
    if (CURRENT_LEVEL <= LOG_LEVELS.info) console.info(`[${timestamp()}] [INFO]`, ...args)
  },
  warn: (...args) => {
    if (CURRENT_LEVEL <= LOG_LEVELS.warn) console.warn(`[${timestamp()}] [WARN]`, ...args)
  },
  error: (...args) => {
    if (CURRENT_LEVEL <= LOG_LEVELS.error) console.error(`[${timestamp()}] [ERROR]`, ...args)
  },
}
