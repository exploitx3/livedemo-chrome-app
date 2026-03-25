module.exports = {
  ENV: 'prod',
  CAPTCHA_SITE_KEY: process.env.CAPTCHA_SITE_KEY || '',
  CAPTCHA_SECRET_KEY: process.env.CAPTCHA_SECRET_KEY || '',
  SERVER_URL: process.env.SERVER_URL || 'https://app.livedemo.ai',
  LANDING_URL: process.env.LANDING_URL || 'https://livedemo.ai',
  APP_URL: process.env.APP_URL || 'https://app.livedemo.ai',
  API_URL: process.env.API_URL || 'https://story-api.livedemo.ai',
  URL_COMMON_DOMAIN: process.env.URL_COMMON_DOMAIN || 'livedemo.ai',
  STRIPE_PUBLISHABLE: process.env.STRIPE_PUBLISHABLE || 'pk_test_',
  CHROME_APP_ID: process.env.CHROME_APP_ID || '',
  CHROME_APP_API: process.env.CHROME_APP_API || 'http://chrome-api.livedemo.ai',
  SOCKET_URL: process.env.SOCKET_URL || 'http://localhost.mine:3003',
  STORIES_API: process.env.STORIES_API || 'http://localhost.mine:3005',
  FLIX_API: process.env.STORIES_API || 'http://localhost.mine:3006',
  CLICK_LIMIT_FOR_AI_RECORDING: parseInt(process.env.CLICK_LIMIT_FOR_AI_RECORDING || '10'),
  SENTRY_DSN: process.env.SENTRY_DSN || ''
}
