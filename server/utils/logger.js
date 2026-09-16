const logger = {
  info: (msg, meta = {}) => {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'INFO', message: msg, ...meta }));
  },
  warn: (msg, meta = {}) => {
    console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: 'WARN', message: msg, ...meta }));
  },
  error: (msg, meta = {}) => {
    // Redact sensitive inputs automatically
    const sanitizedMeta = { ...meta };
    delete sanitizedMeta.password;
    delete sanitizedMeta.cardNumber;
    delete sanitizedMeta.cvv;
    delete sanitizedMeta.token;
    
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'ERROR', message: msg, ...sanitizedMeta }));
  }
};

export default logger;