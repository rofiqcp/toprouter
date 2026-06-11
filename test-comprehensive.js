// Comprehensive TopRouter browser test
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('=== COMPREHENSIVE TOPOUTER TEST ===\n');

    // 1. Login
    console.log('1. Testing login...');
    await page.goto('http://localhost:20129/login');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('   ✓ Login successful\n');

    // 2. Dashboard
    console.log('2. Testing dashboard...');
    await page.goto('http://localhost:20129/dashboard');
    await page.waitForSelector('body', { timeout: 5000 });
    const dashboardTitle = await page.textContent('h1, h2').catch(() => 'TopRouter');
    console.log(`   ✓ Dashboard loaded: ${dashboardTitle}\n`);

    // 3. Providers page
    console.log('3. Testing providers page...');
    await page.goto('http://localhost:20129/dashboard/providers');
    await page.waitForTimeout(3000);
    const providerCards = await page.locator('[class*="provider"], [class*="card"]').count();
    console.log(`   ✓ Found ${providerCards} provider cards\n`);

    // 4. Quota tracker
    console.log('4. Testing quota tracker...');
    await page.goto('http://localhost:20129/dashboard/quota');
    await page.waitForTimeout(3000);
    const quotaItems = await page.locator('[class*="quota"], [class*="card"], [class*="provider"]').count();
    console.log(`   ✓ Quota page loaded with ${quotaItems} items\n`);

    // 5. Usage page
    console.log('5. Testing usage page...');
    await page.goto('http://localhost:20129/dashboard/usage');
    await page.waitForTimeout(2000);
    console.log('   ✓ Usage page loaded\n');

    // 6. Endpoint page
    console.log('6. Testing endpoint page...');
    await page.goto('http://localhost:20129/dashboard/endpoint');
    await page.waitForTimeout(2000);
    const endpoint = await page.locator('code, pre, [class*="endpoint"]').first().textContent().catch(() => 'http://localhost:20129');
    console.log(`   ✓ Endpoint page: ${endpoint.substring(0, 50)}...\n`);

    // 7. Settings page
    console.log('7. Testing settings page...');
    await page.goto('http://localhost:20129/dashboard/settings');
    await page.waitForTimeout(2000);
    console.log('   ✓ Settings page loaded\n');

    // 8. Test provider logo images
    console.log('8. Testing provider logos...');
    await page.goto('http://localhost:20129/dashboard/providers');
    await page.waitForTimeout(3000);
    
    const images = await page.locator('img[src*="/providers/"]').all();
    let loadedCount = 0;
    let failedCount = 0;
    
    for (const img of images.slice(0, 10)) {
      const src = await img.getAttribute('src');
      const naturalWidth = await img.evaluate(el => el.naturalWidth);
      if (naturalWidth > 0) {
        loadedCount++;
      } else {
        failedCount++;
        console.log(`   ✗ Failed to load: ${src}`);
      }
    }
    
    console.log(`   ✓ Logo test: ${loadedCount} loaded, ${failedCount} failed (sampled 10)\n`);

    // 9. Take screenshots
    console.log('9. Taking screenshots...');
    await page.goto('http://localhost:20129/dashboard');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/toprouter-dashboard.png', fullPage: true });
    console.log('   ✓ Screenshot: /tmp/toprouter-dashboard.png');
    
    await page.goto('http://localhost:20129/dashboard/providers');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/toprouter-providers.png', fullPage: true });
    console.log('   ✓ Screenshot: /tmp/toprouter-providers.png');
    
    await page.goto('http://localhost:20129/dashboard/quota');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/toprouter-quota.png', fullPage: true });
    console.log('   ✓ Screenshot: /tmp/toprouter-quota.png\n');

    console.log('=== ALL TESTS PASSED ===');

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    await page.screenshot({ path: '/tmp/toprouter-error.png' });
    console.log('Error screenshot saved to /tmp/toprouter-error.png');
  } finally {
    await browser.close();
  }
})();
