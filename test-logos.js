// Test TopRouter logos with Playwright
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    // Login
    console.log('Logging in to TopRouter (via proxy 20131)...');
    await page.goto('http://localhost:20131/login');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✓ Logged in\n');

    // Navigate to providers page
    console.log('Navigating to providers page...');
    await page.goto('http://localhost:20131/dashboard/providers');
    await page.waitForSelector('h2', { timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for images to load
    console.log('✓ On providers page\n');

    // Take screenshot
    await page.screenshot({ path: '/tmp/toprouter-providers.png', fullPage: true });
    console.log('✓ Screenshot saved to /tmp/toprouter-providers.png\n');

    // Get all provider cards and check logos
    const cards = await page.$$('[class*="group min-w-0"]');
    console.log(`Found ${cards.length} provider cards\n`);

    const results = [];
    for (const card of cards) {
      const name = await card.$eval('h3', el => el.textContent).catch(() => 'Unknown');
      const img = await card.$('img');
      
      if (img) {
        const src = await img.getAttribute('src');
        const loaded = await img.evaluate(el => el.complete && el.naturalWidth > 0).catch(() => false);
        const width = await img.evaluate(el => el.naturalWidth).catch(() => 0);
        results.push({ name, src, loaded, width, status: loaded ? '✓' : '✗' });
      } else {
        const fallback = await card.$eval('[class*="inline-flex"]', el => el.textContent).catch(() => null);
        results.push({ name, fallback, status: fallback ? '⚠' : '✗' });
      }
    }

    // Print results
    console.log('=== Logo Status ===\n');
    console.log(`${'Provider'.padEnd(30)} ${'Status'.padEnd(5)} ${'Details'}`);
    console.log('='.repeat(70));
    
    let loaded = 0, fallback = 0, failed = 0;
    for (const r of results) {
      if (r.loaded) {
        loaded++;
        console.log(`${r.name.padEnd(30)} ${r.status}     ${r.src} (${r.width}px)`);
      } else if (r.fallback) {
        fallback++;
        console.log(`${r.name.padEnd(30)} ${r.status}     Fallback: "${r.fallback}"`);
      } else {
        failed++;
        console.log(`${r.name.padEnd(30)} ${r.status}     No logo`);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`✓ Loaded: ${loaded}`);
    console.log(`⚠ Fallback text: ${fallback}`);
    console.log(`✗ Failed: ${failed}`);

    // Check for any 404 errors
    const failedImgs = results.filter(r => !r.loaded && !r.fallback);
    if (failedImgs.length > 0) {
      console.log('\n⚠️  Failed images:');
      for (const f of failedImgs) {
        console.log(`   - ${f.name}: ${f.src || 'no src'}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/toprouter-error.png' });
  } finally {
    await browser.close();
  }
})();
