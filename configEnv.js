
const DEV_CONFIG = require('./configs/dev')
const STAGING_CONFIG = require('./configs/staging')
const PROD_CONFIG = require('./configs/prod')

const CONFIGS = {
  dev: DEV_CONFIG,
  staging: STAGING_CONFIG,
  prod: PROD_CONFIG
}
// let ENV = 'prod'
let ENV = process.env.ENV || 'dev'
console.log("Environment built for " + ENV)


const fs = require('fs');

fs.writeFileSync('./src/config.json', JSON.stringify(CONFIGS[ENV]))
