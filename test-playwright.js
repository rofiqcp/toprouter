const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('=== Testing toprouter on localhost:20129 ===\\n');
  
  // Test 1: Navigate to app
  console.log('[1] Navigating to http://localhost:20129...');
  const response = await page.goto('http://localhost:20129', { waitUntil: 'networkidle' });
  console.log(`    Status: ${response.status()}`);
  console.log(`    Final URL: ${page.url()}`);
  
  // Wait for React to hydrate
  await page.waitForTimeout(1500);
  
  // Dump page content for debugging
  const bodyText = await page.textContent('body');
  console.log(`    Body text preview: "${bodyText.substring(0, 300)}"`);
  
  // Test 2: Find all input elements
  console.log('\n[2] Scanning for login elements...');
  const inputs = await page.$$('input');
  console.log(`    Input elements found: ${inputs.length}`);
  for (const el of inputs) {
    const type = await el.getAttribute('type');
    const placeholder = await el.getAttribute('placeholder');
    const name = await el.getAttribute('name');
    const id = await el.getAttribute('id');
    console.log(`    -> type="${type}" placeholder="${placeholder}" name="${name}" id="${id}"`);
  }
  
  const buttons = await page.$$('button');
  console.log(`    Button elements found: ${buttons.length}`);
  for (const el of buttons) {
    const text = await el.textContent();
    const type = await el.getAttribute('type');
    console.log(`    -> text="${text.trim()}" type="${type}"`);
  }
  
  // Test 3: Try login
  const password = process.env.INITIAL_PASSWORD || 'admin123';
  console.log(`\n[3] Attempting login with password="${password.substring(0,3)}..."`);
  
  // Try to find password input by various selectors
  let pwdField = null;
  const selectors = [
    'input[type="password"]',
    'input[name="password"]',
    'input[placeholder*="assword" i]',
    'input[placeholder*="kata" i]',
    'input[placeholder*="sandi" i]',
    'input#password',
  ];
  
  for (const sel of selectors) {
    pwdField = await page.$(sel);
    if (pwdField) {
      console.log(`    Found password field: ${sel}`);
      break;
    }
  }
  
  if (pwdField) {
    await pwdField.fill(password);
    // Wait for React state update after fill
    await page.waitForTimeout(500);
    
    // Find submit button
    let submitBtn = null;
    const btnSelectors = [
      'button[type="submit"]',
      'button:has-text("Login")',
      'button:has-text("Masuk")',
      'button:has-text("Sign in")',
      'button:has-text("Submit")',
      'button',
    ];
    
    for (const sel of btnSelectors) {
      submitBtn = await page.$(sel);
      if (submitBtn) {
        const text = await submitBtn.textContent();
        console.log(`    Found submit button: "${text.trim()}" via ${sel}`);
        break;
      }
    }
    
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      console.log(`    URL after login: ${page.url()}`);
      
      if (page.url().includes('dashboard') || !page.url().includes('login')) {
        console.log('    Login SUCCESS \u2713');
      } else {
        // Check for error messages
        const errorEl = await page.$('[class*="error" i], [class*="alert" i], .text-red-500');
        if (errorEl) {
          const errText = await errorEl.textContent();
          console.log(`    Login failed: "${errText.trim()}"`);
        } else {
          console.log('    Login may have failed (still on login page, no error visible)');
        }
      }
    }
  } else {
    console.log('    Password field NOT FOUND - dumping full HTML:');
    const html = await page.content();
    console.log(html.substring(0, 2000));
  }
  
  // Test 4: API health
  console.log('\n[4] Testing API health...');
  try {
    const apiResp = await page.goto('http://localhost:20129/api/health', { timeout: 5000 });
    console.log(`    /api/health status: ${apiResp.status()}`);
    const body = await apiResp.text();
    console.log(`    Response: ${body.substring(0, 200)}`);
  } catch (e) {
    console.log(`    /api/health: ${e.message.substring(0, 100)}`);
  }
  
  // Test 5: Concurrent load test
  console.log('\n[5] Testing concurrent requests (50 parallel)...');
  const start = Date.now();
  const promises = Array.from({ length: 50 }, (_, i) => {
    return context.newPage().then(pg => 
      pg.goto('http://localhost:20129/api/health', { waitUntil: 'networkidle', timeout: 10000 })
        .then(r => { pg.close(); return { idx: i, status: r.status(), time: Date.now() - start }; })
        .catch(e => { pg.close(); return { idx: i, status: 'error', time: Date.now() - start, err: e.message.substring(0, 60) }; })
    );
  });
  const results = await Promise.all(promises);
  const ok = results.filter(r => r.status === 200).length;
  const errors = results.filter(r => r.status !== 200).length;
  const times = results.map(r => r.time);
  const avgTime = times.reduce((s, t) => s + t, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  console.log(`    Results: ${ok}/50 OK, ${errors} errors`);
  console.log(`    Avg: ${Math.round(avgTime)}ms | Min: ${minTime}ms | Max: ${maxTime}ms`);
  
  await browser.close();
  console.log('\n=== Test Complete ===');
})();