// Test TopRouter responsive design - mobile, tablet, desktop
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  const viewports = [
    { name: 'Mobile (iPhone 12)', width: 390, height: 844 },
    { name: 'Tablet (iPad)', width: 768, height: 1024 },
    { name: 'Desktop (1080p)', width: 1920, height: 1080 },
  ];

  console.log('=== RESPONSIVE DESIGN TEST ===\n');

  for (const viewport of viewports) {
    console.log(`Testing ${viewport.name} (${viewport.width}x${viewport.height})...`);
    
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      userAgent: viewport.width < 768 ? 
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15' :
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    const page = await context.newPage();

    try {
      // Login
      await page.goto('http://localhost/login');
      await page.waitForSelector('input[type="password"]', { timeout: 5000 });
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 5000 });
      console.log('  ✓ Login works');

      // Dashboard
      await page.goto('http://localhost/dashboard');
      await page.waitForTimeout(2000);
      console.log('  ✓ Dashboard loads');

      // Providers
      await page.goto('http://localhost/dashboard/providers');
      await page.waitForTimeout(2000);
      const providerCards = await page.locator('[class*="provider"], [class*="card"]').count();
      console.log(`  ✓ Providers page (${providerCards} cards)`);

      // Quota
      await page.goto('http://localhost/dashboard/quota');
      await page.waitForTimeout(2000);
      console.log('  ✓ Quota tracker loads');

      // Screenshot
      const filename = `/tmp/toprouter-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: filename, fullPage: false });
      console.log(`  ✓ Screenshot: ${filename}\n`);

    } catch (error) {
      console.error(`  ✗ Error: ${error.message}\n`);
    }

    await context.close();
  }

  await browser.close();
  console.log('=== RESPONSIVE TEST COMPLETE ===');
})();
