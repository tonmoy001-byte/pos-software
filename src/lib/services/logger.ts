type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  storeId?: string;
  userId?: string;
  action?: string;
  duration?: number;
  error?: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, meta: Partial<LogEntry> = {}) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const line = JSON.stringify(entry);
  switch (level) {
    case "error": console.error(line); break;
    case "warn": console.warn(line); break;
    case "debug": console.debug(line); break;
    default: console.log(line); break;
  }
}

export const logger = {
  info: (msg: string, meta?: Partial<LogEntry>) => log("info", msg, meta),
  warn: (msg: string, meta?: Partial<LogEntry>) => log("warn", msg, meta),
  error: (msg: string, meta?: Partial<LogEntry>) => log("error", msg, meta),
  debug: (msg: string, meta?: Partial<LogEntry>) => log("debug", msg, meta),
};
