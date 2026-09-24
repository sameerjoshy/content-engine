import { createRequire } from 'module';
const require = createRequire('D:/GTM-Engine/compass/');
const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const results = [];
const check = (name, ok, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') check('console error: ' + m.text(), false); });

try {
  // 1. Public landing renders (no login wall on homepage)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.showcase-hero h1', { timeout: 10000 });
  check('public landing renders (no redirect to login)', !page.url().includes('/login'));

  // 2. Sign in
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', 'test-ce@example.com');
  await page.fill('input[type=password]', 'TestPass123!');
  await page.click('button[type=submit]');
  await page.waitForURL(BASE + '/', { timeout: 15000 });
  check('sign-in navigates to profiles', true);

  // 3. Lobby renders (single entrance → 5 engines)
  await page.waitForSelector('.lobby-card', { timeout: 15000 });
  const lobbyCards = await page.locator('.lobby-card').count();
  check('lobby renders 5 engines', lobbyCards === 5, `${lobbyCards} cards`);

  // 3b. Create space -> profiles render
  await page.goto(BASE + '/create', { waitUntil: 'networkidle' });
  await page.waitForSelector('.profile-card', { timeout: 15000 });
  const cards = await page.locator('.profile-card').count();
  check('profile cards render', cards >= 4, `${cards} cards`);

  // 4. Select a profile -> article input
  await page.locator('.profile-card').first().locator('button').click();
  await page.waitForURL('**/new', { timeout: 10000 });
  check('selecting profile opens article input', page.url().includes('/new'));

  // 4b. Agent Engine surface (5 engines)
  await page.goto(BASE + '/engine', { waitUntil: 'networkidle' });
  await page.waitForSelector('.engine-group', { timeout: 10000 });
  const groupCount = await page.locator('.engine-group').count();
  check('engine renders 5 engines', groupCount === 5, `${groupCount} engines`);
  const navEngine = await page.locator('.topbar a[href="/engine"]').count();
  check('engine in top nav', navEngine > 0);

  // 5. Validation: Run button disabled until valid (back on the article input)
  await page.goto(BASE + '/new', { waitUntil: 'networkidle' });
  const runDisabled = await page.locator('button:has-text("Run Article")').isDisabled();
  check('Run disabled with empty inputs', runDisabled);

  await page.fill('input[placeholder="e.g. AI in content workflows"]', 'AI content workflows');
  await page.fill('input[placeholder="e.g. Why most AI content pipelines fail"]', 'Why most AI content pipelines fail at execution');
  await page.waitForTimeout(300);
  const runEnabled = !(await page.locator('button:has-text("Run Article")').isDisabled());
  check('Run enabled with valid inputs', runEnabled);

  // 6. Studio loads
  await page.goto(BASE + '/studio', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Profile Studio', { timeout: 10000 });
  check('studio renders', true);
  const hasAnalyze = await page.locator('button:has-text("Analyze inputs")').count();
  check('studio has analyze button', hasAnalyze > 0);

  // 7. Click analyze
  await page.locator('button:has-text("Analyze inputs")').first().click();
  await page.waitForSelector('text=Input quality score', { timeout: 60000 });
  check('analyze inputs works (score rendered)', true);
} catch (e) {
  check('flow exception: ' + e.message, false);
}

await browser.close();
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
process.exit(failed ? 1 : 0);