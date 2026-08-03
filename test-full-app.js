// ═══════════════════════════════════════════════════════════
// Full App Debug Test Suite
// ═══════════════════════════════════════════════════════════

const fs = require('fs');

const appJS = fs.readFileSync('app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');

const results = [];
function test(name, pass, detail) {
  results.push({ name, pass, detail: detail || '' });
}

// ═══════════════════════════════════════════════════════════
// STRUCTURAL TESTS
// ═══════════════════════════════════════════════════════════

test('IIFE wrapping', appJS.includes('(function BobApp()'));
test('Single state object', appJS.includes('const state = {'));
test('DOM cache pattern', appJS.includes('function cacheDom()'));
test('Event delegation', appJS.includes("document.addEventListener('click'"));
test('No inline onclick in HTML', !html.includes('onclick='));
test('Async script loading (fetch)', appJS.includes("fetch('full-script.txt')"));
test('No sync XHR', !appJS.includes(', false)'));
test('localStorage persistence', appJS.includes('localStorage.setItem'));
test('Autosave debounce', appJS.includes('debouncedSave'));
test('ARIA live region', html.includes('aria-live="polite"'));

// ═══════════════════════════════════════════════════════════
// UI CLEANUP TESTS
// ═══════════════════════════════════════════════════════════

test('No step-pill-num in HTML', !html.includes('step-pill-num'));
test('No step-pill-label in HTML', !html.includes('step-pill-label'));
test('Step pills are text-only', html.includes('step-pill') && html.match(/class="step-pill"[^>]*>\s*\w/i));
test('No download button in HTML', !html.includes('download-btn') && !html.includes('data-action="download"'));
test('No download button styling in CSS', !css.includes('cta-btn--purple'));
test('No download handler in event delegation', !appJS.includes("case 'download'"));
test('No help-mode-note element in HTML', !html.includes('help-mode-note'));
test('No welcome-btn class in HTML', !html.includes('welcome-btn'));
test('No welcome-buttons class in HTML', !html.includes('welcome-buttons'));
test('No welcome-sub class in HTML', !html.includes('welcome-sub'));
test('Mode cards exist in HTML', html.includes('mode-card'));
test('Mode card CSS exists', css.includes('.mode-card'));
test('Hero badge exists', html.includes('hero-badge'));
test('Hero badge CSS exists', css.includes('.hero-badge'));
test('Hero tagline class exists', html.includes('hero-tagline'));

// ═══════════════════════════════════════════════════════════
// FEATURE TESTS
// ═══════════════════════════════════════════════════════════

test('Katie Groove module exists', appJS.includes('const katie = {'));
test('Katie Groove phases defined', appJS.includes('KATIE_PHASES'));
test('Katie Groove in HTML', html.includes('block-katie'));
test('Katie Groove CSS exists', css.includes('.katie-'));
test('Katie start-katie action', html.includes('data-action="start-katie"'));
test('Expert mode module exists', appJS.includes('const expert = {'));
test('Expert analyzeCode function', appJS.includes('analyzeCode'));
test('Expert fillFormFromAnalysis', appJS.includes('fillFormFromAnalysis'));
test('Review populate function', appJS.includes('review.populate') || appJS.includes('populate()'));
test('Legal scan module exists', appJS.includes('const legalScan = {'));
test('Legal scan button in HTML', html.includes('legal-scan-btn'));
test('Copy button in HTML', html.includes('copy-btn'));
test('Generate button in HTML', html.includes('data-action="generate"'));

// ═══════════════════════════════════════════════════════════
// INTEGRITY TESTS
// ═══════════════════════════════════════════════════════════

const blockIds = [0,1,2,3,4,5,6,7,8,9];
test('All block IDs present', blockIds.every(i => html.includes(`id="block-${i}"`)));

const fields = ['projectName','projectDescription','coreUser','coreProblem',
  'coreAction','coreResult','coreFeatures','designDirection','brandName','knownConstraints'];
test('All form fields present', fields.every(f => html.includes(`id="${f}"`)));

const radios = ['sourceMode','platform','distribution','auth','database','ai','payments','seo','darkMode','autonomy'];
test('All radio groups present', radios.every(r => html.includes(`name="${r}"`)));

test('Script load order correct', html.indexOf('builder-script.js') < html.indexOf('app.js'));
test('No Cloudflare scripts', !html.includes('cloudflareinsights'));
test('window.BobApp exposed', appJS.includes('window.BobApp'));
test('isExpertMode in state', appJS.includes('isExpertMode'));
test('isKatieMode in state', appJS.includes('isKatieMode'));
test('Keyboard nav Enter for Katie', appJS.includes("katie.submitAnswer"));
test('CSS design tokens', css.includes('--primary:') && css.includes('--surface:'));
test('Reduced motion CSS', css.includes('prefers-reduced-motion'));
test('Responsive breakpoint', css.includes('@media'));

// ═══════════════════════════════════════════════════════════
// CROSS-REFERENCE TESTS (HTML ↔ JS)
// ═══════════════════════════════════════════════════════════

// Check that every data-action in HTML has a handler in JS
const htmlActions = [...html.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]);
const jsActions = [...appJS.matchAll(/case '([^']+)':/g)].map(m => m[1]);
const missingHandlers = htmlActions.filter(a => !jsActions.includes(a));
test(`All HTML actions have JS handlers (${htmlActions.length} actions)`, missingHandlers.length === 0,
  missingHandlers.length > 0 ? `Missing: ${missingHandlers.join(', ')}` : '');

// Check that mode-card buttons have correct data-actions
test('Katie card has start-katie action', html.includes('data-action="start-katie"'));
test('Expert card has go-expert action', html.includes('data-action="go-expert"'));
test('Quick mode card has set-mode action', html.includes('data-action="set-mode"'));

// ═══════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  BOB THE BUILDER PRO — FULL APP DEBUG TEST');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0, failed = 0;
const failures = [];
results.forEach(r => {
  const icon = r.pass ? '✅' : '❌';
  const detail = r.detail ? ` (${r.detail})` : '';
  console.log(`  ${icon} ${r.name}${detail}`);
  if (r.pass) passed++; else { failed++; failures.push(r.name); }
});

console.log('\n───────────────────────────────────────────────────────────');
console.log(`  PASSED: ${passed}/${results.length}   FAILED: ${failed}/${results.length}`);
if (failures.length > 0) {
  console.log('\n  FAILURES:');
  failures.forEach(f => console.log(`    ❌ ${f}`));
}
console.log('═══════════════════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
