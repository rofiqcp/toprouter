// Test quota tracker with Playwright - wait for data to load
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    console.log('Logging in...');
    await page.goto('http://localhost:20131/login');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✓ Logged in\n');

    // Navigate to quota page
    console.log('Navigating to quota page...');
    await page.goto('http://localhost:20131/dashboard/quota');
    
    // Wait for the main content (grid of cards)
    await page.waitForSelector('[class*="grid"]', { timeout: 15000 });
    console.log('✓ Quota page loaded\n');

    // Wait for quota data to load (up to 30 seconds)
    console.log('Waiting for quota data to load...');
    await page.waitForTimeout(10000);

    // Take screenshot
    await page.screenshot({ path: '/tmp/toprouter-quota.png', fullPage: true });
    console.log('✓ Screenshot saved to /tmp/toprouter-quota.png\n');

    // Get quota cards
    const cards = await page.$$('[class*="grid"] > div');
    console.log(`Found ${cards.length} quota cards\n`);

    // Print first 15 cards
    for (let i = 0; i < Math.min(cards.length, 15); i++) {
      const card = cards[i];
      const text = await card.textContent();
      // Clean up text
      const cleanText = text.replace(/\s+/g, ' ').trim();
      console.log(`Card ${i + 1}: ${cleanText.substring(0, 150)}...`);
    }

    // Check for codex/claude/github specifically
    console.log('\n=== Looking for codex/claude/github ===');
    for (let i = 0; i < Math.min(cards.length, 20); i++) {
      const card = cards[i];
      const text = await card.textContent();
      if (text.toLowerCase().includes('codex') || text.toLowerCase().includes('claude') || text.toLowerCase().includes('github')) {
        const cleanText = text.replace(/\s+/g, ' ').trim();
        console.log(`Card ${i + 1}: ${cleanText.substring(0, 200)}...`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/toprouter-quota-error.png' });
  } finally {
    await browser.close();
  }
})();
