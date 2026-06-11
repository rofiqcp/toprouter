const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture console
  page.on('console', msg => console.log(`  [CONSOLE ${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`  [PAGE ERROR] ${err.message}`));
  
  console.log('[1] Loading login page...');
  await page.goto('http://localhost:20129/login', { waitUntil: 'load', timeout: 30000 });
  console.log(`    URL: ${page.url()}`);
  
  // Wait longer for hydration
  await page.waitForTimeout(5000);
  
  console.log('[2] Page state:');
  const bodyText = await page.textContent('body');
  console.log(`    Body: "${bodyText.substring(0, 500)}"`);
  
  // Try to find elements with timeout
  console.log('[3] Waiting for input elements...');
  try {
    await page.waitForSelector('input', { timeout: 10000 });
    console.log('    Input FOUND!');
  } catch {
    console.log('    No input after 10s wait');
  }
  
  // Try to find any interactive element
  const allElements = await page.$$('*');
  console.log(`    Total DOM elements: ${allElements.length}`);
  
  // Look for login-related text
  const textContent = await page.evaluate(() => document.body.innerText);
  console.log(`    Visible text: "${textContent.substring(0, 500)}"`);
  
  await browser.close();
})();
