let currentStep = 0;
const totalSteps = 10;

function goStep(n) {
  currentStep = Math.max(0, Math.min(totalSteps - 1, n));
  renderStep();
}

function nextStep() {
  if (currentStep < totalSteps - 1) {
    currentStep++;
    renderStep();
  } else if (currentStep === totalSteps - 1) {
    generatePrompt();
  }
}

function prevStep() {
  if (currentStep > 0) currentStep--;
  renderStep();
}

function renderStep() {
  // Apply help mode styling
  document.querySelectorAll('.block').forEach(b => {
    b.classList.toggle('expanded-help', helpMode === 'need-help');
  });

  // Hide all blocks
  document.querySelectorAll('.block').forEach(b => b.style.display = 'none');
  const active = document.getElementById('block-' + currentStep);
  if (active) active.style.display = 'block';

  // Nav buttons
  document.querySelectorAll('.step-nav-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === currentStep);
  });

  // Progress bar (side)
  const pct = ((currentStep) / (totalSteps - 1)) * 100;
  const fill = document.getElementById('side-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const jump = document.getElementById('step-jump');
  if (jump) jump.value = currentStep;

  // Footer buttons
  document.getElementById('btn-prev').disabled = currentStep === 0;
  const btnNext = document.getElementById('btn-next');
  if (currentStep === totalSteps - 1) {
    btnNext.style.display = 'none';
  } else {
    btnNext.style.display = 'inline-block';
    btnNext.textContent = 'Next →';
  }
  document.getElementById('step-counter').textContent = `Step ${currentStep + 1} of ${totalSteps}`;
}

function buildData() {
  const sourceMode = document.querySelector('input[name="sourceMode"]:checked')?.value || 'NEW_PRODUCT';
  return {
    projectName: document.getElementById('projectName').value,
    projectDescription: document.getElementById('projectDescription').value,
    coreUser: document.getElementById('coreUser').value,
    coreProblem: document.getElementById('coreProblem').value,
    coreAction: document.getElementById('coreAction').value,
    coreResult: document.getElementById('coreResult').value,
    sourceMode,
    sourceUrl: document.getElementById('sourceUrl').value || 'N/A',
    authConfirm: document.getElementById('authConfirm').value || 'N/A',
    platform: document.querySelector('input[name="platform"]:checked')?.value,
    distribution: document.querySelector('input[name="distribution"]:checked')?.value,
    coreFeatures: document.getElementById('coreFeatures').value,
    auth: document.querySelector('input[name="auth"]:checked')?.value,
    database: document.querySelector('input[name="database"]:checked')?.value,
    ai: document.querySelector('input[name="ai"]:checked')?.value,
    payments: document.querySelector('input[name="payments"]:checked')?.value,
    seo: document.querySelector('input[name="seo"]:checked')?.value,
    darkMode: document.querySelector('input[name="darkMode"]:checked')?.value,
    designDirection: document.getElementById('designDirection').value,
    brandName: document.getElementById('brandName').value,
    brandColorPrimary: document.getElementById('brandColorPrimary').value,
    brandColorSecondary: document.getElementById('noSecondary')?.checked ? 'none' : (document.getElementById('brandColorSecondary')?.value || 'agent decides'),
    knownConstraints: document.getElementById('knownConstraints').value,
    autonomy: document.querySelector('input[name="autonomy"]:checked')?.value
  };
}

function generatePrompt() {
  try {
    const d = buildData();
    const rawText = document.getElementById('rawCode') ? document.getElementById('rawCode').value : '';
    const expertContent = expertScriptText || rawText || window.BUILDER_SCRIPT_TEXT;

    const intakeFormText = `PROJECT INTAKE — FILLED BY BOB, THE BUILDING PRO
PROJECT_NAME: ${d.projectName || 'N/A'}
DESCRIPTION: ${d.projectDescription || 'N/A'}
USER: ${d.coreUser || 'N/A'}
PROBLEM: ${d.coreProblem || 'N/A'}
ACTION: ${d.coreAction || 'N/A'}
RESULT: ${d.coreResult || 'N/A'}
SOURCE: ${d.sourceMode || 'NEW_PRODUCT'}
URL: ${d.sourceUrl || 'N/A'}
PLATFORM: ${d.platform || 'WEB'}
DISTRIBUTION: ${d.distribution || 'DEPLOYABLE_WEB'}
FEATURES: ${d.coreFeatures || 'N/A'}
AUTH: ${d.auth || 'NONE'} | DB: ${d.database || 'NONE'} | AI: ${d.ai || 'NONE'} | PAYMENTS: ${d.payments || 'NONE'}
SEO: ${d.seo || 'NONE'} | DARK: ${d.darkMode || 'YES'}
DESIGN: ${d.designDirection || 'N/A'} | BRAND: ${d.brandName || 'N/A'}
COLORS: ${d.brandColorPrimary || '#f97316'}
CONSTRAINTS: ${d.knownConstraints || 'none'}
AUTONOMY: ${d.autonomy || 'AUTONOMOUS'}`;

    const fullPrompt = intakeFormText + '\n\n=== BUILDER SCRIPT / EXPERT CODE ===\n\n' + expertContent + '\n\n=== DISCLAIMER ===\n© DelQuro Labs, LLC — Entertainment only. No warranty. Verify independently.';

    let out = document.getElementById('output-area');
    if (!out) {
      out = document.createElement('div');
      out.id = 'output-area';
      out.className = 'output-box';
      out.style.display = 'block';
      document.getElementById('block-8').appendChild(out);
    }
    out.textContent = fullPrompt;
    out.style.display = 'block';
    out.scrollIntoView({behavior:'smooth', block:'nearest'});
  } catch (e) {
    alert('Generate completed with errors. Check console. Error: ' + e.message);
    console.error('GeneratePrompt error:', e);
  }
}

function downloadPrompt() {
  const d = buildData();
  const intakeFormText = `PROJECT INTAKE — ${d.projectName || 'project'}\n\n` +
    `Name: ${d.projectName}\nDescription: ${d.projectDescription}\nUser: ${d.coreUser}\n` +
    `Problem: ${d.coreProblem}\nAction: ${d.coreAction}\nResult: ${d.coreResult}\n` +
    `Platform: ${d.platform}\nDistribution: ${d.distribution}\n` +
    `Source: ${d.sourceMode}\nConstraints: ${d.knownConstraints}\nAutonomy: ${d.autonomy}`;
  const full = intakeFormText + '\n\n--- BUILDER SCRIPT ---\n' + window.BUILDER_SCRIPT_TEXT;
  const blob = new Blob([full], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (d.projectName || 'bob-building') + '-prompt.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  renderStep();

  // Initialize color mode buttons active state
  document.getElementById('btn-agent').classList.add('active-mode');

  // Sync color picker with text input
  const picker = document.getElementById('primaryColorPicker');
  const text = document.getElementById('brandColorPrimary');
  if (picker && text) {
    picker.addEventListener('input', (e) => {
      text.value = e.target.value;
    });
    text.addEventListener('input', (e) => {
      if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
        picker.value = e.target.value;
      }
    });
  }
});

// Load full script text synchronously so it's always ready
function loadScriptSync() {
  try {
    const req = new XMLHttpRequest();
    req.open('GET', 'full-script.txt', false);
    req.send();
    if (req.status === 200 || req.status === 0) {
      BUILDER_SCRIPT_TEXT = req.responseText;
    }
  } catch (e) {
    BUILDER_SCRIPT_TEXT = 'Could not load full script.';
  }
}
loadScriptSync();

let helpMode = 'got-this';

function runLegalScan(data) {
  const results = [];
  let riskScore = 0;

  // Source mode analysis
  if (data.sourceMode === 'AUTHORIZED_REBUILD') {
    if (!data.authConfirm || !data.authConfirm.toLowerCase().includes('confirm')) {
      results.push({ level: 'HIGH', msg: 'AUTHORIZED_REBUILD selected but authorization confirmation missing or unclear. Risk: copyright infringement claim possible.' });
      riskScore += 3;
    } else {
      results.push({ level: 'LOW', msg: 'AUTHORIZATION confirmed — rebuild within permitted scope.' });
    }
  } else if (data.sourceMode === 'PUBLIC_PRODUCT_INSPIRATION') {
    results.push({ level: 'MEDIUM', msg: 'PUBLIC_INSPIRATION: Must reimplement independently. Do not inspect private pages or copy code/assets/trademarks.' });
    riskScore += 2;
  } else {
    results.push({ level: 'LOW', msg: 'NEW_PRODUCT — original work, lowest copyright risk.' });
  }

  // Source URL analysis
  if (data.sourceUrl && data.sourceUrl !== 'N/A' && data.sourceUrl !== '') {
    results.push({ level: 'INFO', msg: 'Source URL provided: ' + data.sourceUrl + '. Ensure only public content is accessed and no paywalls bypassed.' });
  }

  // Brand / Trademark
  if (data.brandName) {
    results.push({ level: 'INFO', msg: 'Brand name: "' + data.brandName + '". Verify this does not conflict with existing trademarks before publication.' });
  }

  // Core features / scope
  if (!data.coreFeatures || data.coreFeatures.trim().length < 10) {
    results.push({ level: 'MEDIUM', msg: 'Core features too brief — vague scope increases risk of unintentional overlap with existing products.' });
    riskScore += 1;
  } else {
    results.push({ level: 'LOW', msg: 'Core features defined — scope appears focused.' });
  }

  // Legal pages reminder
  results.push({ level: 'REQUIRED', msg: 'All generated legal pages (Terms, Privacy, etc.) are DRAFTS and require professional legal review before commercial use.' });

  // Summary
  const overall = riskScore >= 3 ? 'HIGH' : riskScore >= 1 ? 'MEDIUM' : 'LOW';

  const scanHTML = `
    <div style="margin-top:16px;padding:16px;background:#0f172a;border:2px solid ${overall === 'HIGH' ? '#ef4444' : overall === 'MEDIUM' ? '#f59e0b' : '#22c55e'};border-radius:10px;color:#e2e8f0;">
      <h3 style="margin:0 0 12px;font-size:1.1rem;color:${overall === 'HIGH' ? '#f87171' : overall === 'MEDIUM' ? '#fbbf24' : '#4ade80'};">⚖️ Legal Scan — ${overall} Risk</h3>
      <ul style="margin:0;padding-left:18px;font-size:.85rem;line-height:1.6;color:#cbd5e1;list-style:none;">
        ${results.map(r => `<li style="margin-bottom:6px;color:${r.level === 'HIGH' ? '#fca5a5' : r.level === 'MEDIUM' ? '#fde047' : r.level === 'REQUIRED' ? '#93c5fd' : '#94a3b8'};"><strong>[${r.level}]</strong> ${r.msg}</li>`).join('')}
      </ul>
      <p style="margin:8px 0 0;font-size:.78rem;color:#94a3b8;border-top:1px solid #334155;padding-top:8px;">Note: This scan checks form inputs only. It does not replace professional legal advice. Always verify ownership, permissions, and trademarks independently.</p>
    </div>
  `;

  let scanArea = document.getElementById('legal-scan-area');
  if (!scanArea) {
    scanArea = document.createElement('div');
    scanArea.id = 'legal-scan-area';
    const out = document.getElementById('output-area');
    out.parentNode.insertBefore(scanArea, out.nextSibling);
  }
  scanArea.innerHTML = scanHTML;
  scanArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setColorMode(mode) {
  const agentBtn = document.getElementById('btn-agent');
  const pickBtn = document.getElementById('btn-pick');
  const row = document.getElementById('color-row');
  const text = document.getElementById('brandColorPrimary');
  const picker = document.getElementById('primaryColorPicker');
  if (mode === 'pick') {
    row.style.display = 'flex';
    text.value = picker.value;
    agentBtn.classList.remove('active-mode');
    pickBtn.classList.add('active-mode');
  } else {
    row.style.display = 'none';
    text.value = 'agent decides';
    picker.value = '#f97316';
    agentBtn.classList.add('active-mode');
    pickBtn.classList.remove('active-mode');
  }
}

function toggleSidebar() {
  const menu = document.getElementById('side-menu');
  menu.classList.toggle('open');
}

let expertScriptText = '';

function loadExpertFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    expertScriptText = e.target.result || '';
    document.getElementById('expert-file-status').textContent = '✓ Loaded: ' + file.name + ' (' + expertScriptText.length + ' chars)';
  };
  reader.readAsText(file);
}

function setHelpMode(mode) {
  helpMode = mode;
  const note = document.getElementById('help-mode-note');
  if (mode === 'need-help') {
    note.textContent = 'Expanded guidance enabled. Each step will show extra explanations and examples.';
  } else {
    note.textContent = 'Brief hints shown. Click any label for more details.';
  }
}
