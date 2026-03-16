export interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string | Error, meta?: Record<string, unknown>) => void;
}

export const createLogger = (namespace = 'voxwit-humor-engine'): Logger => {
  const emit = (level: 'log' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) => {
    const payload = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    console[level](`[${namespace}] ${message}${payload}`);
  };

  return {
    info: (message, meta) => emit('log', message, meta),
    warn: (message, meta) => emit('warn', message, meta),
    error: (message, meta) => {
      if (message instanceof Error) {
        emit('error', message.message, { stack: message.stack, ...meta });
      } else {
        emit('error', message, meta);
      }
    },
  };
};
