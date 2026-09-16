const path = require('node:path');
const os = require('node:os');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const launchOptions = {headless:true};
if (process.env.CRM_QA_BROWSER) launchOptions.executablePath = process.env.CRM_QA_BROWSER;
else if (process.platform === 'darwin') launchOptions.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
module.exports = {chromium:playwright.chromium, launchOptions};
