/**
 * FinansRadar — Winston Structured Logger
 * Console + dosya loglama, Winston yoksa fallback
 */

// Winston isteğe bağlı — yoksa console'a fallback
let winston;
try {
  winston = (await import('winston')).default;
} catch {
  winston = null;
}

const isDev = process.env.NODE_ENV !== 'production';

// Basit fallback logger (Winston yoksa)
class ConsoleLogger {
  _format(level, message, meta) {
    const ts = new Date().toISOString();
    const metaStr = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${ts}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }
  info(message, meta = {})  { console.log(this._format('info', message, meta)); }
  warn(message, meta = {})  { console.warn(this._format('warn', message, meta)); }
  error(message, meta = {}) { console.error(this._format('error', message, meta)); }
  debug(message, meta = {}) { if (isDev) console.log(this._format('debug', message, meta)); }
  http(message, meta = {})  { if (isDev) console.log(this._format('http', message, meta)); }
}

let logger;

if (winston) {
  const { createLogger, format, transports } = winston;
  const { combine, timestamp, colorize, printf, json, errors } = format;

  const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  });

  logger = createLogger({
    level: isDev ? 'debug' : 'info',
    format: combine(errors({ stack: true }), timestamp({ format: 'HH:mm:ss' }), json()),
    transports: [
      new transports.Console({
        format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), consoleFormat),
      }),
    ],
  });
} else {
  logger = new ConsoleLogger();
}

// HTTP request logger middleware
export function httpLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
    logger[level] || logger.info.call(logger, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
}

export default logger;
