import { chromium } from 'playwright';
import path from 'path';

const SCREENSHOTS_DIR = 'C:\\Users\\laris\\.gemini\\antigravity-ide\\brain\\1b41f70a-a25d-44c9-be9d-dde142a99521\\screenshots';
const BASE = 'http://localhost:3000';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark'
  });
  const page = await context.newPage();

  console.log('→ Dashboard...');
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_dashboard.png') });

  console.log('→ Finance Overview...');
  await page.goto(`${BASE}/#/finance`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_finance_overview.png') });

  console.log('→ Finance Transactions...');
  await page.goto(`${BASE}/#/finance/transactions`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_finance_transactions.png') });

  console.log('→ Commercial Overview...');
  await page.goto(`${BASE}/#/commercial`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_commercial_overview.png') });

  console.log('→ Quotes...');
  await page.goto(`${BASE}/#/commercial/quotes`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_commercial_quotes.png') });

  console.log('→ Tasks...');
  await page.goto(`${BASE}/#/tasks`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_tasks.png') });

  console.log('→ Settings...');
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '13_settings.png') });

  // Mobile viewport captures
  console.log('→ Mobile captures...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '19_mobile_dashboard.png') });

  await page.goto(`${BASE}/#/finance`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '20_mobile_finance.png') });

  await browser.close();
  console.log('\n✅ Script completed!');
}

run().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
