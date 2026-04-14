const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://typeset.us/about', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/about_v2.png', fullPage: true });
  await browser.close();
  console.log('Screenshot saved to /tmp/about_v2.png');
})();
