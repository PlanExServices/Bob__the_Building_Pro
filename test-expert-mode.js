// Expert Mode Integration Test
// Tests the complete expert mode flow

const fs = require('fs');
const path = require('path');

// Read the app.js file
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

console.log('🧪 Testing Expert Mode Integration\n');

const tests = [
  {
    name: 'State has isExpertMode flag',
    test: () => appJs.includes('isExpertMode: false')
  },
  {
    name: 'State has expertSource field',
    test: () => appJs.includes('expertSource: \'\'')
  },
  {
    name: 'Expert evaluate sets isExpertMode to true',
    test: () => appJs.includes('state.isExpertMode = true')
  },
  {
    name: 'Expert evaluate sets expertSource for files',
    test: () => appJs.includes('state.expertSource = file.name')
  },
  {
    name: 'Expert evaluate sets expertSource for pasted code',
    test: () => appJs.includes('state.expertSource = \'pasted\'')
  },
  {
    name: 'Review has populateExpert method',
    test: () => appJs.includes('populateExpert()')
  },
  {
    name: 'Review checks isExpertMode before populating',
    test: () => appJs.includes('if (state.isExpertMode && state.expertScript)')
  },
  {
    name: 'Prompt has generateExpert method',
    test: () => appJs.includes('generateExpert()')
  },
  {
    name: 'Prompt.generate checks expert mode',
    test: () => {
      const lines = appJs.split('\n');
      const generateFn = lines.findIndex(l => l.trim().startsWith('generate()'));
      if (generateFn === -1) return false;
      // Check next 10 lines for expert mode check
      const nextLines = lines.slice(generateFn, generateFn + 10).join('\n');
      return nextLines.includes('state.isExpertMode') && nextLines.includes('generateExpert()');
    }
  },
  {
    name: 'Expert code preview styled in CSS',
    test: () => {
      const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
      return css.includes('.expert-code-preview');
    }
  },
  {
    name: 'Review section expert mode styled',
    test: () => {
      const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
      return css.includes('.review-section--expert');
    }
  },
  {
    name: 'Reset clears expert mode state',
    test: () => {
      const lines = appJs.split('\n');
      const resetFn = lines.findIndex(l => l.includes('reset()'));
      if (resetFn === -1) return false;
      const nextLines = lines.slice(resetFn, resetFn + 20).join('\n');
      return nextLines.includes('isExpertMode = false') &&
             nextLines.includes('expertScript = \'\'') &&
             nextLines.includes('expertSource = \'\'');
    }
  },
  {
    name: 'Back button handles expert mode',
    test: () => {
      const lines = appJs.split('\n');
      const prevFn = lines.findIndex(l => l.includes('prev()'));
      if (prevFn === -1) return false;
      const nextLines = lines.slice(prevFn, prevFn + 15).join('\n');
      return nextLines.includes('state.isExpertMode') && nextLines.includes('EXPERT_STEP');
    }
  }
];

// Run tests
let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  try {
    const result = test.test();
    if (result) {
      console.log(`✅ Test ${index + 1}: ${test.name}`);
      passed++;
    } else {
      console.log(`❌ Test ${index + 1}: ${test.name}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ Test ${index + 1}: ${test.name} (Error: ${error.message})`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${tests.length} total`);

if (failed > 0) {
  process.exit(1);
}

console.log('\n✨ All expert mode tests passed!\n');
