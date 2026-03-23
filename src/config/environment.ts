export default () => ({
  appName: process.env.APP_NAME || 'LogWork BE',
  mode: process.env.MODE,
  host: process.env.APP_HOST || 'http://localhost',
  domain: process.env.APP_DOMAIN || 'localhost',
  webHost: process.env.WEB_HOST || 'http://localhost',
  consoleHost: process.env.CONSOLE_HOST || 'http://localhost',
  port: parseInt(process.env.PORT, 10) || 8080,
  version: process.env.APP_VERSION || '2.0.0',
  jwt: {
    secret: process.env.JWT_SECRET_KEY || '',
    expiresIn: process.env.JWT_EXPIRES || '1d',
  },
  database: process.env.MONGODB_URI || '',
  resend: {
    apiKey: process.env.RESEND_API_KEY,
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  autoBan: {
    windowMinutes: Number(process.env.AUTO_BAN_WINDOW_MINUTES) || 5,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botForUserToken: process.env.TELEGRAM_BOT_FOR_USER_TOKEN || '',
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '',
  },
  supportEmail: process.env.SUPPORT_EMAIL || '',
});
