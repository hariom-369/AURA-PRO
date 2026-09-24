const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|private.?key|token|authorization|cookie|card.?number|cvv|cvc|verification.?code|sms.?code|otp|phone.?number/i;

const redactSensitiveData = (value, seen = new WeakSet()) => {
  if (value === null || typeof value !== "object") {
    return typeof value === "bigint" ? value.toString() : value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, seen));
  }

  const sanitized = {};

  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = redactSensitiveData(item, seen);
    }
  }

  return sanitized;
};

const writeLog = (level, msg, meta = {}) => {
  let sanitizedMeta = {};

  try {
    sanitizedMeta = redactSensitiveData(meta);
  } catch {
    sanitizedMeta = { loggingError: "Unable to sanitize metadata" };
  }

  const entry = {
    ...sanitizedMeta,
    timestamp: new Date().toISOString(),
    level,
    message: String(msg),
  };

  let serialized;

  try {
    serialized = JSON.stringify(entry);
  } catch {
    serialized = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message: String(msg),
      loggingError: "Unable to serialize log entry",
    });
  }

  if (level === "ERROR") {
    console.error(serialized);
  } else if (level === "WARN") {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
};

const logger = {
  info: (msg, meta = {}) => writeLog("INFO", msg, meta),
  warn: (msg, meta = {}) => writeLog("WARN", msg, meta),
  error: (msg, meta = {}) => writeLog("ERROR", msg, meta),
};

export default logger;