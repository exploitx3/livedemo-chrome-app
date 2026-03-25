const ENV = require("../src/config.json");
module.exports = {
  ENV: 'dev',
  CAPTCHA_SITE_KEY: process.env.CAPTCHA_SITE_KEY || '',
  CAPTCHA_SECRET_KEY: process.env.CAPTCHA_SECRET_KEY || '',
  SERVER_URL: process.env.SERVER_URL || 'http://localhost.mine:5000',
  APP_URL: process.env.APP_URL || 'http://localhost.mine:5000',
  LANDING_URL: process.env.LANDING_URL || 'http://livedemo.ai',
  API_URL: process.env.API_URL || 'http://localhost:3005',
  // API_URL: process.env.API_URL || 'https://unwrongful-risa-subglacial.ngrok-free.dev',
  STRIPE_PUBLISHABLE: process.env.STRIPE_PUBLISHABLE || 'pk_test_',
  URL_COMMON_DOMAIN: process.env.URL_COMMON_DOMAIN || 'localhost.mine',
  CHROME_APP_ID: process.env.CHROME_APP_ID || '',
  CHROME_APP_API: process.env.CHROME_APP_API || 'http://localhost.mine:3003',
  SOCKET_URL: process.env.SOCKET_URL || 'http://localhost.mine:3003',
  STORIES_API: process.env.STORIES_API || 'http://localhost:3005',//'http://localhost.mine:3005',
  FLIX_API: process.env.STORIES_API || 'https://localhost.mine:3006',
  CLICK_LIMIT_FOR_AI_RECORDING: parseInt(process.env.CLICK_LIMIT_FOR_AI_RECORDING || '10'),
  SENTRY_DSN: process.env.SENTRY_DSN || ''
}
