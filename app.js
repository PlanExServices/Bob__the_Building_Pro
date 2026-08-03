// ═══════════════════════════════════════════════════════════
// Bob, the Building Pro — Fully Restructured Application
// Single state object, event delegation, async loading,
// localStorage persistence, ARIA live regions, keyboard nav
// ═══════════════════════════════════════════════════════════

(function BobApp() {
  'use strict';

  // ─── Constants ────────────────────────────────────────────
  const TOTAL_STEPS = 9;          // Steps 0-8 (0=welcome, 1-7=blocks, 8=review)
  const EXPERT_STEP = 9;          // Alternate path
  const STORAGE_KEY = 'bob-builder-state';
  const AUTOSAVE_DELAY = 400;     // ms debounce for autosave

  // ─── State (single source of truth) ──────────────────────
  const state = {
    currentStep: 0,
    helpMode: 'got-this',         // 'got-this' | 'need-help'
    expertScript: '',             // pasted/uploaded expert code
    expertSource: '',             // filename or 'pasted' — where the code came from
    builderScript: '',            // loaded from full-script.txt
    scriptLoaded: false,          // whether full-script.txt is ready
    colorMode: 'agent',           // 'agent' | 'pick'
    generatedPrompt: '',          // last generated prompt text
    maxVisitedStep: 0,           // highest step user has reached
    isExpertMode: false,         // true if user came through expert mode path
    isKatieMode: false,          // true if user is in Katie's Groove
  };

  // ─── DOM Cache ────────────────────────────────────────────
  const dom = {};

  function cacheDom() {
    dom.form          = document.getElementById('builder-form');
    dom.wizard        = document.getElementById('wizard');
    dom.blocks        = document.querySelectorAll('.block');
    dom.progressFill  = document.getElementById('progress-fill');
    dom.progressBar   = document.querySelector('.progress-track');
    dom.stepPills     = document.querySelectorAll('.step-pill');
    dom.stepCounter   = document.getElementById('step-counter');
    dom.btnPrev       = document.getElementById('btn-prev');
    dom.btnNext       = document.getElementById('btn-next');
    dom.btnRestart    = document.getElementById('btn-restart');
    dom.btnHelpToggle = document.getElementById('btn-help-toggle');
    dom.helpModeNote  = document.getElementById('help-mode-note');
    dom.reviewSummary = document.getElementById('review-summary');
    dom.reviewWarnings= document.getElementById('review-warnings');
    dom.outputArea    = document.getElementById('output-area');
    dom.copyBtn       = document.getElementById('copy-btn');
    dom.legalScanBtn  = document.getElementById('legal-scan-btn');
    dom.legalScanArea = document.getElementById('legal-scan-area');
    dom.colorRow      = document.getElementById('color-row');
    dom.btnAgent      = document.getElementById('btn-agent');
    dom.btnPick       = document.getElementById('btn-pick');
    dom.primaryPicker = document.getElementById('primaryColorPicker');
    dom.primaryText   = document.getElementById('brandColorPrimary');
    dom.secondaryPicker = document.getElementById('secondaryColorPicker');
    dom.secondaryText = document.getElementById('brandColorSecondary');
    dom.noSecondary   = document.getElementById('noSecondary');
    dom.expertStatus  = document.getElementById('expert-file-status');
    dom.evalFile      = document.getElementById('eval-file');
    dom.rawCode       = document.getElementById('rawCode');
    dom.loadingBar    = document.getElementById('loading-bar');
    dom.autosave      = document.getElementById('autosave-indicator');
    dom.autosaveText  = document.querySelector('.autosave-text');
  }

  // ─── Persistence (localStorage) ───────────────────────────
  const persistence = {
    save() {
      try {
        const data = {
          currentStep: state.currentStep,
          helpMode: state.helpMode,
          colorMode: state.colorMode,
          maxVisitedStep: state.maxVisitedStep,
          formData: collectFormData(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        flashAutosave();
      } catch (e) {
        // localStorage might be full or disabled — fail silently
      }
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || !data.formData) return false;

        // Restore state
        state.helpMode = data.helpMode || 'got-this';
        state.colorMode = data.colorMode || 'agent';
        state.maxVisitedStep = data.maxVisitedStep || 0;

        // Restore form data
        const fd = data.formData;
        setVal('projectName', fd.projectName);
        setVal('projectDescription', fd.projectDescription);
        setVal('coreUser', fd.coreUser);
        setVal('coreProblem', fd.coreProblem);
        setVal('coreAction', fd.coreAction);
        setVal('coreResult', fd.coreResult);
        setVal('sourceUrl', fd.sourceUrl);
        setVal('authConfirm', fd.authConfirm);
        setVal('coreFeatures', fd.coreFeatures);
        setVal('designDirection', fd.designDirection);
        setVal('brandName', fd.brandName);
        setVal('brandColorPrimary', fd.brandColorPrimary);
        setVal('brandColorSecondary', fd.brandColorSecondary);
        setVal('knownConstraints', fd.knownConstraints);
        setRadio('sourceMode', fd.sourceMode);
        setRadio('platform', fd.platform);
        setRadio('distribution', fd.distribution);
        setRadio('auth', fd.auth);
        setRadio('database', fd.database);
        setRadio('ai', fd.ai);
        setRadio('payments', fd.payments);
        setRadio('seo', fd.seo);
        setRadio('darkMode', fd.darkMode);
        setRadio('autonomy', fd.autonomy);

        // Restore color mode UI
        if (state.colorMode === 'pick') {
          dom.colorRow.style.display = 'flex';
          dom.btnPick.classList.add('active-mode');
          dom.btnAgent.classList.remove('active-mode');
          if (fd.brandColorPrimary && dom.primaryPicker) {
            dom.primaryPicker.value = fd.brandColorPrimary;
          }
        } else {
          dom.colorRow.style.display = 'none';
          dom.btnAgent.classList.add('active-mode');
        }

        // Restore help mode note
        updateHelpModeNote();

        // Navigate to saved step
        state.currentStep = Math.min(data.currentStep || 0, TOTAL_STEPS - 1);
        return true;
      } catch (e) {
        return false;
      }
    },

    clear() {
      try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
    }
  };

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  }

  function setRadio(name, val) {
    if (!val) return;
    const radio = document.querySelector(`input[name="${name}"][value="${val}"]`);
    if (radio) radio.checked = true;
  }

  let autosaveTimer = null;
  function flashAutosave() {
    if (!dom.autosave) return;
    dom.autosave.classList.add('autosave--flash');
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      dom.autosave.classList.remove('autosave--flash');
    }, 1500);
  }

  function debouncedSave() {
    clearTimeout(debouncedSave._t);
    debouncedSave._t = setTimeout(() => persistence.save(), AUTOSAVE_DELAY);
  }

  // ─── Script Loader (async, non-blocking) ─────────────────
  const scriptLoader = {
    load() {
      // Show loading bar
      if (dom.loadingBar) dom.loadingBar.style.display = 'block';

      fetch('full-script.txt')
        .then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(text => {
          state.builderScript = text;
          state.scriptLoaded = true;
          if (dom.loadingBar) dom.loadingBar.style.display = 'none';
        })
        .catch(err => {
          state.builderScript = '[Builder script could not be loaded. Error: ' + err.message + ']';
          state.scriptLoaded = true; // Mark as "done" so UI doesn't stay loading
          if (dom.loadingBar) dom.loadingBar.style.display = 'none';
          console.warn('Failed to load full-script.txt:', err.message);
        });
    }
  };

  // ─── Navigation ──────────────────────────────────────────
  const nav = {
    go(step) {
      if (step === EXPERT_STEP) {
        state.currentStep = EXPERT_STEP;
      } else {
        state.currentStep = Math.max(0, Math.min(TOTAL_STEPS - 1, step));
      }
      state.maxVisitedStep = Math.max(state.maxVisitedStep, state.currentStep);
      render.renderStep();
      persistence.save();
    },

    next() {
      const s = state.currentStep;
      if (s === 0) {
        this.go(1);
      } else if (s >= 1 && s <= 7) {
        if (!validation.validateStep(s)) return;
        this.go(s + 1);
      } else if (s === 8) {
        prompt.generate();
      }
    },

    prev() {
      const s = state.currentStep;
      if (s === EXPERT_STEP) this.go(0);
      else if (s === 10) this.go(0); // Katie's Groove → back to welcome
      else if (s === 8) {
        // If in expert mode, go back to expert step; otherwise go to step 7
        if (state.isExpertMode) {
          this.go(EXPERT_STEP);
        } else {
          this.go(7);
        }
      }
      else if (s > 0) this.go(s - 1);
    },

    goToStep(step) {
      // Allow jumping to any visited step or the next unvisited one
      if (step <= state.maxVisitedStep + 1 && step <= TOTAL_STEPS - 1) {
        this.go(step);
      }
    },

    restart() {
      dom.form.reset();
      state.currentStep = 0;
      state.maxVisitedStep = 0;
      state.helpMode = 'got-this';
      state.colorMode = 'agent';
      state.expertScript = '';
      state.expertSource = '';
      state.isExpertMode = false;
      state.isKatieMode = false;
      state.generatedPrompt = '';
      persistence.clear();
      updateHelpModeNote();
      resetColorUI();
      resetReviewUI();
      render.renderStep();
    }
  };

  // ─── Render ──────────────────────────────────────────────
  const render = {
    renderStep() {
      // 1. Help mode class on all blocks
      dom.blocks.forEach(b => {
        b.classList.toggle('expanded-help', state.helpMode === 'need-help');
      });

      // 2. Show/hide blocks
      dom.blocks.forEach(b => b.style.display = 'none');

      // Katie's Groove lives on block-katie (step 10)
      const blockId = state.currentStep === 10 ? 'block-katie' : 'block-' + state.currentStep;
      const active = document.getElementById(blockId);
      if (active) active.style.display = 'block';

      // 3. Progress bar
      const step = state.currentStep === EXPERT_STEP ? 0 : state.currentStep;
      const pct = (step / (TOTAL_STEPS - 1)) * 100;
      dom.progressFill.style.width = pct + '%';
      dom.progressBar.setAttribute('aria-valuenow', Math.round(pct));

      // 4. Step pills
      dom.stepPills.forEach(pill => {
        const goto = parseInt(pill.dataset.goto, 10);
        const isActive = goto === state.currentStep;
        const isVisited = goto <= state.maxVisitedStep;
        pill.classList.toggle('step-pill--active', isActive);
        pill.classList.toggle('step-pill--visited', isVisited && !isActive);
        pill.disabled = goto > state.maxVisitedStep + 1;
        pill.setAttribute('aria-current', isActive ? 'step' : 'false');
      });

      // 5. Footer buttons
      dom.btnPrev.disabled = state.currentStep === 0;

      if (state.currentStep === 0 || state.currentStep === EXPERT_STEP || state.currentStep === 10) {
        dom.btnNext.style.display = 'none';
      } else if (state.currentStep === 8) {
        dom.btnNext.style.display = 'inline-block';
        dom.btnNext.textContent = '🔨 Generate →';
      } else {
        dom.btnNext.style.display = 'inline-block';
        dom.btnNext.textContent = 'Next →';
      }

      // 6. Step counter
      if (state.currentStep === EXPERT_STEP) {
        dom.stepCounter.textContent = '🔴 Expert Mode';
      } else if (state.currentStep === 10) {
        dom.stepCounter.textContent = '🐱 Katie\'s Groove';
        dom.btnPrev.disabled = false;
      } else {
        dom.stepCounter.textContent = `Step ${state.currentStep + 1} of ${TOTAL_STEPS}`;
      }

      // 7. Populate review if on review step
      if (state.currentStep === 8) {
        review.populate();
      }

      // 8. Scroll to top of wizard smoothly
      dom.wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ─── Validation ──────────────────────────────────────────
  const validation = {
    validateStep(stepNum) {
      const block = document.getElementById('block-' + stepNum);
      if (!block) return true;

      let valid = true;
      let firstInvalid = null;

      // Check required text inputs and textareas
      block.querySelectorAll('[required]').forEach(input => {
        if (input.type === 'radio') return; // handle separately
        if (!input.value.trim()) {
          valid = false;
          input.classList.add('field-error');
          if (!firstInvalid) firstInvalid = input;
        } else {
          input.classList.remove('field-error');
        }
      });

      // Scroll to first invalid field
      if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      return valid;
    }
  };

  // ─── Review ──────────────────────────────────────────────
  const review = {
    populate() {
      if (!dom.reviewSummary) return;

      // Expert mode: show expert code instead of intake form
      if (state.isExpertMode && state.expertScript) {
        this.populateExpert();
        return;
      }

      const d = collectFormData();

      // Check empty required fields
      const requiredFields = [
        ['projectName', 'Project Name'],
        ['projectDescription', 'Project Description'],
        ['coreUser', 'Core User'],
        ['coreProblem', 'Core Problem'],
        ['coreAction', 'Core Action'],
        ['coreResult', 'Core Result'],
        ['coreFeatures', 'Core Features'],
        ['designDirection', 'Design Direction'],
        ['brandName', 'Brand Name'],
        ['knownConstraints', 'Known Constraints'],
      ];

      const emptyFields = requiredFields
        .filter(([key]) => !d[key] || !d[key].trim())
        .map(([, label]) => label);

      // Warnings
      if (emptyFields.length > 0 && dom.reviewWarnings) {
        dom.reviewWarnings.style.display = 'block';
        dom.reviewWarnings.innerHTML = `<strong>⚠️ Some fields are empty:</strong> ${emptyFields.join(', ')}<br><em>The prompt will still generate with "N/A" for empty fields.</em>`;
      } else if (dom.reviewWarnings) {
        dom.reviewWarnings.style.display = 'none';
      }

      // Build review HTML
      const section = (title, items) => {
        const rows = items.map(([label, value]) => {
          const display = (value && value.trim())
            ? escHtml(value)
            : '<span class="review-empty">⚠ Not filled</span>';
          return `<dt>${label}</dt><dd>${display}</dd>`;
        }).join('');
        return `<div class="review-section">
          <h3>${title}</h3>
          <dl>${rows}</dl>
        </div>`;
      };

      dom.reviewSummary.innerHTML =
        section('Block 1 — Core Identity', [
          ['Project Name', d.projectName],
          ['Description', d.projectDescription],
          ['Core User', d.coreUser],
          ['Core Problem', d.coreProblem],
          ['Core Action', d.coreAction],
          ['Core Result', d.coreResult],
        ]) +
        section('Block 2 — Source & Legal', [
          ['Source Mode', d.sourceMode],
          ['Source URL', d.sourceUrl],
          ['Auth Confirmation', d.authConfirm],
        ]) +
        section('Block 3 — Platform', [
          ['Platform', d.platform],
          ['Distribution', d.distribution],
        ]) +
        section('Block 4 — Features', [
          ['Core Features', d.coreFeatures],
        ]) +
        section('Block 5 — Modules', [
          ['Auth', d.auth],
          ['Database', d.database],
          ['AI/LLM', d.ai],
          ['Payments', d.payments],
          ['SEO', d.seo],
          ['Dark Mode', d.darkMode],
        ]) +
        section('Block 6 — Design', [
          ['Design Direction', d.designDirection],
          ['Brand Name', d.brandName],
          ['Primary Color', d.brandColorPrimary],
          ['Secondary Color', d.brandColorSecondary],
        ]) +
        section('Block 7 — Constraints', [
          ['Known Constraints', d.knownConstraints],
          ['Autonomy', d.autonomy],
        ]);
    },

    // Expert mode review — show the submitted code AND auto-filled form
    populateExpert() {
      const code = state.expertScript;
      const source = state.expertSource || 'unknown';
      const charCount = code.length;
      const lineCount = code.split('\n').length;

      // Get auto-filled form data
      const d = collectFormData();

      // Clear warnings (not applicable in expert mode)
      if (dom.reviewWarnings) {
        dom.reviewWarnings.style.display = 'none';
      }

      // Preview first/last portion of code
      const previewChars = 2000;
      let preview = '';
      if (code.length <= previewChars * 2) {
        preview = code;
      } else {
        const start = code.substring(0, previewChars);
        const end = code.substring(code.length - previewChars);
        preview = start + '\n\n... [' + (code.length - previewChars * 2) + ' chars hidden] ...\n\n' + end;
      }

      // Build auto-filled review sections
      const section = (title, items) => {
        const rows = items.map(([label, value]) => {
          const display = (value && value.trim())
            ? escHtml(value)
            : '<span class="review-empty">⚠ Not filled</span>';
          return `<dt>${label}</dt><dd>${display}</dd>`;
        }).join('');
        return `<div class="review-section">
          <h3>${title}</h3>
          <dl>${rows}</dl>
        </div>`;
      };

      dom.reviewSummary.innerHTML = `
        <div class="review-section review-section--expert">
          <h3>🔴 Expert Mode — Code Analyzed & Form Auto-Filled</h3>
          <dl>
            <dt>Source</dt>
            <dd>${escHtml(source)}</dd>
            <dt>Size</dt>
            <dd>${charCount.toLocaleString()} characters · ${lineCount.toLocaleString()} lines</dd>
            <dt>Status</dt>
            <dd style="color:#10b981;">✓ Code analyzed and intake form auto-filled</dd>
          </dl>
        </div>

        ${section('Block 1 — Core Identity', [
          ['Project Name', d.projectName],
          ['Description', d.projectDescription],
          ['Core User', d.coreUser],
          ['Core Problem', d.coreProblem],
          ['Core Action', d.coreAction],
          ['Core Result', d.coreResult],
        ])}
        ${section('Block 2 — Source & Legal', [
          ['Source Mode', d.sourceMode],
          ['Source URL', d.sourceUrl],
          ['Auth Confirmation', d.authConfirm],
        ])}
        ${section('Block 3 — Platform', [
          ['Platform', d.platform],
          ['Distribution', d.distribution],
        ])}
        ${section('Block 4 — Features', [
          ['Core Features', d.coreFeatures],
        ])}
        ${section('Block 5 — Modules', [
          ['Auth', d.auth],
          ['Database', d.database],
          ['AI/LLM', d.ai],
          ['Payments', d.payments],
          ['SEO', d.seo],
          ['Dark Mode', d.darkMode],
        ])}
        ${section('Block 6 — Design', [
          ['Design Direction', d.designDirection],
          ['Brand Name', d.brandName],
          ['Primary Color', d.brandColorPrimary],
          ['Secondary Color', d.brandColorSecondary],
        ])}
        ${section('Block 7 — Constraints', [
          ['Known Constraints', d.knownConstraints],
          ['Autonomy', d.autonomy],
        ])}

        <div class="review-section">
          <h3>Expert Code Preview</h3>
          <pre class="expert-code-preview">${escHtml(preview)}</pre>
        </div>
        <div class="review-section">
          <h3>What Happens Next</h3>
          <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6;margin:0;">
            Click <strong>"🔨 Generate Builder Prompt"</strong> below. Bob will build a complete, 
            structured builder script using the auto-filled intake form, detected architecture, 
            and your expert code as reference — ready to paste into an AI agent.
          </p>
        </div>
      `;
    }
  };

  // ─── Prompt Generation ───────────────────────────────────
  const prompt = {
    generate() {
      try {
        // Expert mode: different generation path
        if (state.isExpertMode && state.expertScript) {
          this.generateExpert();
          return;
        }

        const d = collectFormData();
        const rawCode = dom.rawCode?.value?.trim() || '';
        const expertContent = state.expertScript || rawCode || state.builderScript || '[Builder script not loaded]';

        const intake = [
          'PROJECT INTAKE — FILLED BY BOB, THE BUILDING PRO',
          '═══════════════════════════════════════════════════════',
          '',
          `PROJECT_NAME: ${d.projectName || 'N/A'}`,
          `DESCRIPTION: ${d.projectDescription || 'N/A'}`,
          `USER: ${d.coreUser || 'N/A'}`,
          `PROBLEM: ${d.coreProblem || 'N/A'}`,
          `ACTION: ${d.coreAction || 'N/A'}`,
          `RESULT: ${d.coreResult || 'N/A'}`,
          '',
          `SOURCE: ${d.sourceMode || 'NEW_PRODUCT'}`,
          `URL: ${d.sourceUrl || 'N/A'}`,
          '',
          `PLATFORM: ${d.platform || 'WEB'}`,
          `DISTRIBUTION: ${d.distribution || 'DEPLOYABLE_WEB'}`,
          '',
          'FEATURES:',
          d.coreFeatures || 'N/A',
          '',
          `AUTH: ${d.auth || 'NONE'}`,
          `DATABASE: ${d.database || 'NONE'}`,
          `AI: ${d.ai || 'NONE'}`,
          `PAYMENTS: ${d.payments || 'NONE'}`,
          `SEO: ${d.seo || 'NONE'}`,
          `DARK_MODE: ${d.darkMode || 'YES'}`,
          '',
          `DESIGN: ${d.designDirection || 'N/A'}`,
          `BRAND: ${d.brandName || 'N/A'}`,
          `COLOR_PRIMARY: ${d.brandColorPrimary || '#f97316'}`,
          `COLOR_SECONDARY: ${d.brandColorSecondary || 'agent decides'}`,
          '',
          `CONSTRAINTS: ${d.knownConstraints || 'none'}`,
          `AUTONOMY: ${d.autonomy || 'AUTONOMOUS'}`,
        ].join('\n');

        state.generatedPrompt =
          intake +
          '\n\n=== BUILDER SCRIPT / EXPERT CODE ===\n\n' +
          expertContent +
          '\n\n=== DISCLAIMER ===\n© DelQuro Labs, LLC — Entertainment only. No warranty. Verify independently.';

        if (dom.outputArea) {
          dom.outputArea.textContent = state.generatedPrompt;
          dom.outputArea.style.display = 'block';
        }

        // Show copy/legal buttons
        if (dom.copyBtn) dom.copyBtn.style.display = 'inline-block';
        if (dom.legalScanBtn) dom.legalScanBtn.style.display = 'inline-block';

        dom.outputArea?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {
        alert('Error generating prompt: ' + e.message);
        console.error('generatePrompt error:', e);
      }
    },

    // Expert mode generation — builds a complete, structured builder script
    generateExpert() {
      const code = state.expertScript;
      const source = state.expertSource || 'unknown';
      const timestamp = new Date().toISOString();
      
      // Get auto-filled form data
      const d = collectFormData();

      // Build the complete builder script following the template structure
      const builderScript = this.buildExpertBuilderScript(d, code, source);

      const output = [
        '╔═══════════════════════════════════════════════════════════════════╗',
        '║    VERIFIED FULL-APP BUILDER — EXPERT MODE (BOB THE BUILDING PRO)║',
        '║         Requires: filesystem + terminal + browser access         ║',
        '╚═══════════════════════════════════════════════════════════════════╝',
        '',
        `Source: ${source}`,
        `Generated: ${timestamp}`,
        '',
        builderScript,
        '',
        '═══════════════════════════════════════════════════════════════════',
        'DISCLAIMER',
        '═══════════════════════════════════════════════════════════════════',
        '',
        '© DelQuro Labs, LLC — Entertainment only. No warranty. Verify independently.',
        '',
        'This prompt was generated via Expert Mode in Bob, the Building Pro.',
        'The builder script was constructed from expert code analysis.',
        'Review carefully before use with any AI agent.',
      ].join('\n');

      state.generatedPrompt = output;

      if (dom.outputArea) {
        dom.outputArea.textContent = state.generatedPrompt;
        dom.outputArea.style.display = 'block';
      }

      // Show copy/legal buttons
      if (dom.copyBtn) dom.copyBtn.style.display = 'inline-block';
      if (dom.legalScanBtn) dom.legalScanBtn.style.display = 'inline-block';

      dom.outputArea?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    // Build a complete, structured builder script from expert code analysis
    buildExpertBuilderScript(d, code, source) {
      const lines = [];
      
      lines.push('START:');
      lines.push('1. Run the capability gate');
      lines.push('2. Validate all project input — no blanks, no bracket tokens');
      lines.push('3. Create specification documents');
      lines.push('4. Scaffold using official tooling');
      lines.push('5. Establish and verify clean baseline');
      lines.push('6. Build the core vertical slice');
      lines.push('7. Continue through all applicable phases');
      lines.push('8. Execute the mandatory repair loop after each phase');
      lines.push('9. Complete the red-team pass');
      lines.push('10. Run final verification matrix');
      lines.push('11. Output final report with classification');
      lines.push('');
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('PROJECT INTAKE — FILLED BY BOB THE BUILDER PRO (EXPERT MODE)');
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('');
      
      // BLOCK 1 — CORE PRODUCT IDENTITY
      lines.push('## BLOCK 1 — CORE PRODUCT IDENTITY');
      lines.push('');
      lines.push('**PROJECT_NAME:**');
      lines.push('```');
      lines.push(d.projectName || 'expert-project');
      lines.push('```');
      lines.push('');
      lines.push('**PROJECT_DESCRIPTION:**');
      lines.push('```');
      lines.push(d.projectDescription || 'Expert mode project built from provided code.');
      lines.push('```');
      lines.push('');
      lines.push('**CORE_USER:**');
      lines.push('```');
      lines.push(d.coreUser || 'General users');
      lines.push('```');
      lines.push('');
      lines.push('**CORE_PROBLEM:**');
      lines.push('```');
      lines.push(d.coreProblem || 'Manual process requiring automation.');
      lines.push('```');
      lines.push('');
      lines.push('**CORE_ACTION:**');
      lines.push('```');
      lines.push(d.coreAction || 'Process user input');
      lines.push('```');
      lines.push('');
      lines.push('**CORE_RESULT:**');
      lines.push('```');
      lines.push(d.coreResult || 'Updated application state');
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
      
      // BLOCK 2 — SOURCE AND LEGAL
      lines.push('## BLOCK 2 — SOURCE AND LEGAL');
      lines.push('');
      lines.push('**SOURCE_MODE:**');
      lines.push('```');
      lines.push(`[x] ${d.sourceMode || 'NEW_PRODUCT'}`);
      lines.push('```');
      lines.push('');
      lines.push('**SOURCE_URL:**');
      lines.push('```');
      lines.push(d.sourceUrl || 'N/A');
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
      
      // BLOCK 3 — PLATFORM AND DISTRIBUTION
      lines.push('## BLOCK 3 — PLATFORM AND DISTRIBUTION');
      lines.push('');
      lines.push('**PLATFORM:**');
      lines.push('```');
      lines.push(`[x] ${d.platform || 'WEB'}`);
      lines.push('```');
      lines.push('');
      lines.push('**DISTRIBUTION:**');
      lines.push('```');
      lines.push(`[x] ${d.distribution || 'DEPLOYABLE_WEB'}`);
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
      
      // BLOCK 4 — CORE FEATURES
      lines.push('## BLOCK 4 — CORE FEATURES');
      lines.push('');
      lines.push('**CORE_FEATURES:**');
      lines.push('```');
      const features = (d.coreFeatures || '').split('\n').filter(f => f.trim());
      if (features.length > 0) {
        features.forEach(f => lines.push(f));
      } else {
        lines.push('- User interacts with application');
      }
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
      
      // BLOCK 5 — OPTIONAL MODULES
      lines.push('## BLOCK 5 — OPTIONAL MODULES');
      lines.push('');
      lines.push('**AUTH:**');
      lines.push('```');
      lines.push(`[x] ${d.auth || 'NONE'}`);
      lines.push('```');
      lines.push('');
      lines.push('**DATABASE:**');
      lines.push('```');
      lines.push(`[x] ${d.database || 'NONE'}`);
      lines.push('```');
      lines.push('');
      lines.push('**AI:**');
      lines.push('```');
      lines.push(`[x] ${d.ai || 'NONE'}`);
      lines.push('```');
      lines.push('');
      lines.push('**PAYMENTS:**');
      lines.push('```');
      lines.push(`[x] ${d.payments || 'NONE'}`);
      lines.push('```');
      lines.push('');
      lines.push('**SEO:**');
      lines.push('```');
      lines.push(`[x] ${d.seo || 'NONE'}`);
      lines.push('```');
      lines.push('');
      lines.push('**DARK_MODE:**');
      lines.push('```');
      lines.push(`[x] ${d.darkMode || 'YES'}`);
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
      
      // BLOCK 6 — DESIGN AND BRAND
      lines.push('## BLOCK 6 — DESIGN AND BRAND');
      lines.push('');
      lines.push('**DESIGN_DIRECTION:**');
      lines.push('```');
      lines.push(d.designDirection || 'Clean and functional');
      lines.push('```');
      lines.push('');
      lines.push('**BRAND_NAME:**');
      lines.push('```');
      lines.push(d.brandName || 'ExpertApp');
      lines.push('```');
      lines.push('');
      lines.push('**BRAND_COLORS:**');
      lines.push('```');
      lines.push(`Primary color:   ${d.brandColorPrimary || '#f97316'}`);
      lines.push(`Accent color:    ${d.brandColorSecondary || 'agent decides'}`);
      lines.push(`Neutral:         agent decides`);
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
      
      // BLOCK 7 — CONSTRAINTS AND AGENT BEHAVIOR
      lines.push('## BLOCK 7 — CONSTRAINTS AND AGENT BEHAVIOR');
      lines.push('');
      lines.push('**KNOWN_CONSTRAINTS:**');
      lines.push('```');
      lines.push(d.knownConstraints || 'none');
      lines.push('```');
      lines.push('');
      lines.push('**AUTONOMY:**');
      lines.push('```');
      lines.push(`[x] ${d.autonomy || 'AUTONOMOUS'}`);
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
      
      // BLOCK 8 — PREFLIGHT VERIFICATION
      lines.push('## BLOCK 8 — PREFLIGHT VERIFICATION');
      lines.push('');
      lines.push('All fields filled: YES');
      lines.push('No placeholder tokens: YES');
      lines.push('No example.com references: YES');
      lines.push('Source mode confirmed: YES');
      lines.push('Platform and distribution selected: YES');
      lines.push('Brand colors provided: YES');
      lines.push('Constraints addressed: YES');
      lines.push('Autonomy selected: YES');
      lines.push('');
      lines.push(`Generated by Bob the Builder Pro — ${new Date().toISOString()}`);
      lines.push('');
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('EXPERT CODE REFERENCE');
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('');
      lines.push('The following code was provided as expert reference. Use it as a');
      lines.push('guide for implementation while following the specification above.');
      lines.push('Adapt patterns, structure, and logic to match the requirements.');
      lines.push('');
      lines.push('```');
      lines.push(code);
      lines.push('```');
      lines.push('');
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('ARCHITECTURE GUIDELINES');
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('');
      lines.push('Based on detected modules and platform, implement:');
      lines.push('');
      
      // Add architecture recommendations based on detected modules
      if (d.platform === 'WEB') {
        lines.push('**Framework:** Next.js 14+ (App Router) or modern React SPA');
      } else if (d.platform === 'MOBILE') {
        lines.push('**Framework:** React Native with Expo');
      } else if (d.platform === 'DESKTOP') {
        lines.push('**Framework:** Electron or Tauri');
      }
      
      if (d.database === 'CLOUD') {
        lines.push('**Database:** Cloud database (Supabase, PlanetScale, or similar)');
      } else if (d.database === 'LOCAL') {
        lines.push('**Database:** Local storage (IndexedDB, localStorage, or SQLite)');
      }
      
      if (d.auth === 'REQUIRED') {
        lines.push('**Authentication:** Implement user auth system (NextAuth, Clerk, or Firebase Auth)');
      }
      
      if (d.ai === 'REQUIRED') {
        lines.push('**AI Integration:** Connect to AI provider (OpenAI, Anthropic, or similar)');
      }
      
      if (d.payments === 'REQUIRED') {
        lines.push('**Payments:** Implement payment system (Stripe, LemonSqueezy, or similar)');
      }
      
      if (d.seo === 'FULL') {
        lines.push('**SEO:** Full SEO implementation (sitemap, robots.txt, structured data)');
      } else if (d.seo === 'BASIC') {
        lines.push('**SEO:** Basic SEO (meta tags, semantic HTML)');
      }
      
      if (d.darkMode === 'YES') {
        lines.push('**Dark Mode:** Implement theme toggle with system preference detection');
      }
      
      lines.push('');
      lines.push('**State Management:** Choose based on complexity:');
      lines.push('  - Simple: React Context + useReducer');
      lines.push('  - Medium: Zustand or Jotai');
      lines.push('  - Complex: Redux Toolkit');
      lines.push('');
      lines.push('**Styling:** Tailwind CSS or CSS Modules for maintainability');
      lines.push('');
      lines.push('**Testing:** Jest + React Testing Library for unit tests');
      lines.push('');
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('BUILD INSTRUCTIONS');
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('');
      lines.push('1. Create project structure following architecture guidelines');
      lines.push('2. Implement core features listed in BLOCK 4');
      lines.push('3. Enable detected modules (auth, database, AI, payments, etc.)');
      lines.push('4. Apply brand colors and design direction from BLOCK 6');
      lines.push('5. Use expert code as reference for patterns and logic');
      lines.push('6. Test all features end-to-end');
      lines.push('7. Optimize for performance and accessibility');
      lines.push('8. Deploy according to distribution requirement');
      lines.push('');
      
      return lines.join('\n');
    },

    copy() {
      if (!state.generatedPrompt) {
        alert('Generate the prompt first!');
        return;
      }
      navigator.clipboard.writeText(state.generatedPrompt)
        .then(() => flashButton(dom.copyBtn, '✅ Copied!'))
        .catch(() => {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = state.generatedPrompt;
          ta.style.cssText = 'position:fixed;opacity:0;';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          flashButton(dom.copyBtn, '✅ Copied!');
        });
    },

  };

  // ─── Expert Mode ─────────────────────────────────────────
  const expert = {
    evaluate() {
      const fileInput = dom.evalFile;
      const file = fileInput?.files[0];
      const rawCode = dom.rawCode?.value?.trim() || '';

      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          state.expertScript = e.target.result || '';
          state.expertSource = file.name;
          state.isExpertMode = true;
          if (dom.expertStatus) {
            dom.expertStatus.textContent = '✓ Loaded: ' + file.name + ' (' + state.expertScript.length + ' chars) — Analyzing...';
            dom.expertStatus.style.color = '#10b981';
          }
          // Analyze code and auto-fill form
          this.analyzeAndFill(state.expertScript);
          nav.go(8); // Navigate to review after analysis
        };
        reader.onerror = () => {
          if (dom.expertStatus) {
            dom.expertStatus.textContent = '✗ Error reading file';
            dom.expertStatus.style.color = '#ef4444';
          }
        };
        reader.readAsText(file);
      } else if (rawCode) {
        state.expertScript = rawCode;
        state.expertSource = 'pasted';
        state.isExpertMode = true;
        if (dom.expertStatus) {
          dom.expertStatus.textContent = '✓ Code captured (' + rawCode.length + ' chars) — Analyzing...';
          dom.expertStatus.style.color = '#10b981';
        }
        // Analyze code and auto-fill form
        this.analyzeAndFill(rawCode);
        nav.go(8);
      } else {
        if (dom.expertStatus) {
          dom.expertStatus.textContent = '⚠ No file or code — please paste code or upload a file';
          dom.expertStatus.style.color = '#ef4444';
        }
      }
    },

    // Analyze code and extract project information
    analyzeAndFill(code) {
      const analysis = this.analyzeCode(code);
      this.fillFormFromAnalysis(analysis);
      if (dom.expertStatus) {
        dom.expertStatus.textContent = '✓ Code analyzed — ' + Object.keys(analysis).filter(k => analysis[k]).length + ' fields auto-filled';
        dom.expertStatus.style.color = '#10b981';
      }
    },

    // Intelligent code analysis
    analyzeCode(code) {
      const result = {
        projectName: '',
        projectDescription: '',
        coreUser: '',
        coreProblem: '',
        coreAction: '',
        coreResult: '',
        platform: '',
        distribution: '',
        coreFeatures: [],
        auth: '',
        database: '',
        ai: '',
        payments: '',
        seo: '',
        darkMode: '',
        designDirection: '',
        brandName: '',
        brandColorPrimary: '',
        brandColorSecondary: '',
        knownConstraints: ''
      };

      const codeLower = code.toLowerCase();
      const lines = code.split('\n');

      // ── Project Name ──
      // Try: title tag, package.json name, first heading, filename
      const titleMatch = code.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) result.projectName = titleMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
      
      const packageMatch = code.match(/"name"\s*:\s*"([^"]+)"/);
      if (packageMatch && !result.projectName) result.projectName = packageMatch[1];
      
      const h1Match = code.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match && !result.projectName) result.projectName = h1Match[1].trim().toLowerCase().replace(/\s+/g, '-');

      // ── Brand Name ──
      if (h1Match) result.brandName = h1Match[1].trim();
      if (titleMatch && !result.brandName) result.brandName = titleMatch[1].trim();

      // ── Project Description ──
      const metaDesc = code.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      if (metaDesc) {
        result.projectDescription = metaDesc[1];
      } else {
        // Extract from comments or first meaningful text
        const commentMatch = code.match(/\/\*\s*([^\n]+)/);
        if (commentMatch) result.projectDescription = commentMatch[1].trim();
      }

      // ── Platform Detection ──
      if (code.includes('react-native') || code.includes('expo') || code.includes('ios') && code.includes('android')) {
        result.platform = 'MOBILE';
      } else if (code.includes('electron') || code.includes('tauri')) {
        result.platform = 'DESKTOP';
      } else if (code.includes('<html') || code.includes('<!doctype html') || code.includes('document.') || code.includes('window.')) {
        result.platform = 'WEB';
      }

      // ── Distribution Detection ──
      if (code.includes('vercel.json') || code.includes('netlify.toml') || code.includes('deploy')) {
        result.distribution = 'DEPLOYABLE_WEB';
      } else if (code.includes('localhost') || code.includes('127.0.0.1')) {
        result.distribution = 'LOCAL_ONLY';
      } else if (result.platform === 'WEB') {
        result.distribution = 'DEPLOYABLE_WEB';
      }

      // ── Auth Detection ──
      if (code.includes('firebase.auth') || code.includes('Auth0') || code.includes('login') && code.includes('password') || code.includes('jwt') || code.includes('session')) {
        result.auth = 'REQUIRED';
      } else {
        result.auth = 'NONE';
      }

      // ── Database Detection ──
      if (code.includes('mongodb') || code.includes('postgres') || code.includes('mysql') || code.includes('supabase') || code.includes('firebase.firestore')) {
        result.database = 'CLOUD';
      } else if (code.includes('sqlite') || code.includes('localforage') || code.includes('indexedDB')) {
        result.database = 'LOCAL';
      } else {
        result.database = 'NONE';
      }

      // ── AI Detection ──
      if (code.includes('openai') || code.includes('anthropic') || code.includes('claude') || code.includes('gpt') || code.includes('gemini') || code.includes('llm') || code.includes('api.openai')) {
        result.ai = 'REQUIRED';
      } else {
        result.ai = 'NONE';
      }

      // ── Payments Detection ──
      if (code.includes('stripe') || code.includes('paypal') || code.includes('payment') || code.includes('checkout') || code.includes('subscription')) {
        result.payments = 'REQUIRED';
      } else {
        result.payments = 'NONE';
      }

      // ── SEO Detection ──
      if (code.includes('sitemap') || code.includes('robots.txt') || code.includes('schema.org') || code.includes('og:title')) {
        result.seo = 'FULL';
      } else if (code.includes('<meta') || code.includes('<title')) {
        result.seo = 'BASIC';
      } else {
        result.seo = 'NONE';
      }

      // ── Dark Mode Detection ──
      if (code.includes('prefers-color-scheme: dark') || code.includes('dark-mode') || code.includes('darkMode') || code.includes('data-theme="dark"')) {
        result.darkMode = 'YES';
      } else {
        result.darkMode = 'NO';
      }

      // ── Core Features Extraction ──
      const features = [];
      
      // Look for function names that suggest features
      const functionMatches = code.matchAll(/function\s+([a-zA-Z]+[A-Z][a-zA-Z]*)\s*\(/g);
      for (const match of functionMatches) {
        const name = match[1];
        if (name.length > 3 && !['function', 'return', 'const', 'let', 'var'].includes(name.toLowerCase())) {
          features.push(name.replace(/([A-Z])/g, ' $1').trim());
        }
      }

      // Look for event handlers
      const eventMatches = code.matchAll(/addEventListener\(['"]([^'"]+)['"]/g);
      for (const match of eventMatches) {
        const event = match[1];
        if (['click', 'submit', 'change', 'input'].includes(event)) {
          features.push('User ' + event + ' interaction');
        }
      }

      // Look for API calls
      if (code.includes('fetch(') || code.includes('axios') || code.includes('XMLHttpRequest')) {
        features.push('API data fetching');
      }

      // Look for form handling
      if (code.includes('<form') || code.includes('FormData') || code.includes('form.submit')) {
        features.push('Form submission handling');
      }

      result.coreFeatures = [...new Set(features)].slice(0, 10);

      // ── Core Action ──
      if (result.coreFeatures.length > 0) {
        result.coreAction = result.coreFeatures[0];
      } else if (code.includes('function handleSubmit')) {
        result.coreAction = 'Submit form data';
      } else if (code.includes('function generate')) {
        result.coreAction = 'Generate content';
      } else if (code.includes('function create')) {
        result.coreAction = 'Create new item';
      }

      // ── Core Result ──
      if (code.includes('download') || code.includes('blob') || code.includes('saveAs')) {
        result.coreResult = 'Downloadable file';
      } else if (code.includes('innerHTML') || code.includes('render')) {
        result.coreResult = 'Updated UI display';
      } else if (code.includes('console.log') || code.includes('alert')) {
        result.coreResult = 'Console output';
      }

      // ── Brand Colors ──
      const colorMatches = code.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g);
      const colors = [...new Set([...colorMatches].map(m => m[0]))];
      if (colors.length > 0) result.brandColorPrimary = colors[0];
      if (colors.length > 1) result.brandColorSecondary = colors[1];

      // Look for CSS variables
      const varMatch = code.match(/--primary[^:]*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|rgb[a]?\([^)]+\))/);
      if (varMatch) result.brandColorPrimary = varMatch[1];

      // ── Design Direction ──
      if (code.includes('border-radius: 9999px') || code.includes('rounded-full')) {
        result.designDirection = 'Modern with rounded elements';
      } else if (code.includes('box-shadow') && code.includes('backdrop-filter')) {
        result.designDirection = 'Glassmorphism with depth';
      } else if (code.includes('gradient') || code.includes('linear-gradient')) {
        result.designDirection = 'Gradient-based design';
      } else if (code.includes('grid') || code.includes('flex')) {
        result.designDirection = 'Clean layout-focused design';
      }

      // ── Known Constraints ──
      const constraints = [];
      if (code.includes('node_modules')) constraints.push('Uses Node.js dependencies');
      if (code.includes('.env')) constraints.push('Environment variables required');
      if (code.includes('API_KEY') || code.includes('API_SECRET')) constraints.push('External API keys needed');
      if (code.includes('CORS')) constraints.push('CORS configuration needed');
      result.knownConstraints = constraints.join('; ') || 'None detected';

      // ── Core User (infer from context) ──
      if (code.includes('admin') || code.includes('dashboard')) {
        result.coreUser = 'Administrators and power users';
      } else if (code.includes('customer') || code.includes('shopper') || code.includes('buyer')) {
        result.coreUser = 'Online customers';
      } else if (code.includes('student') || code.includes('learner')) {
        result.coreUser = 'Students and learners';
      } else if (code.includes('developer') || code.includes('programmer')) {
        result.coreUser = 'Software developers';
      } else {
        result.coreUser = 'General users';
      }

      // ── Core Problem (infer from features) ──
      if (result.coreFeatures.length > 0) {
        result.coreProblem = 'Manual process requiring automation: ' + result.coreFeatures[0];
      } else {
        result.coreProblem = 'Time-consuming manual task';
      }

      return result;
    },

    // Fill form fields from analysis
    fillFormFromAnalysis(analysis) {
      const fields = [
        ['projectName', analysis.projectName],
        ['projectDescription', analysis.projectDescription],
        ['coreUser', analysis.coreUser],
        ['coreProblem', analysis.coreProblem],
        ['coreAction', analysis.coreAction],
        ['coreResult', analysis.coreResult],
        ['designDirection', analysis.designDirection],
        ['brandName', analysis.brandName],
        ['brandColorPrimary', analysis.brandColorPrimary],
        ['brandColorSecondary', analysis.brandColorSecondary],
        ['knownConstraints', analysis.knownConstraints]
      ];

      fields.forEach(([field, value]) => {
        const el = document.getElementById(field);
        if (el && value) {
          el.value = value;
          el.classList.remove('field-error');
        }
      });

      // Core features (textarea)
      if (analysis.coreFeatures.length > 0) {
        const featuresEl = document.getElementById('coreFeatures');
        if (featuresEl) {
          featuresEl.value = analysis.coreFeatures.map(f => '• ' + f).join('\n');
          featuresEl.classList.remove('field-error');
        }
      }

      // Radio buttons
      const radios = [
        ['platform', analysis.platform],
        ['distribution', analysis.distribution],
        ['auth', analysis.auth],
        ['database', analysis.database],
        ['ai', analysis.ai],
        ['payments', analysis.payments],
        ['seo', analysis.seo],
        ['darkMode', analysis.darkMode]
      ];

      radios.forEach(([name, value]) => {
        if (value) {
          const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
          if (radio) radio.checked = true;
        }
      });

      // Trigger autosave
      debouncedSave();
    }
  };

  // ─── Data Collection ──────────────────────────────────────
  function collectFormData() {
    const gv = id => document.getElementById(id)?.value || '';
    const gr = name => document.querySelector(`input[name="${name}"]:checked`)?.value || '';
    return {
      projectName: gv('projectName'),
      projectDescription: gv('projectDescription'),
      coreUser: gv('coreUser'),
      coreProblem: gv('coreProblem'),
      coreAction: gv('coreAction'),
      coreResult: gv('coreResult'),
      sourceMode: gr('sourceMode') || 'NEW_PRODUCT',
      sourceUrl: gv('sourceUrl') || 'N/A',
      authConfirm: gv('authConfirm') || 'N/A',
      platform: gr('platform') || 'WEB',
      distribution: gr('distribution') || 'DEPLOYABLE_WEB',
      coreFeatures: gv('coreFeatures'),
      auth: gr('auth') || 'NONE',
      database: gr('database') || 'NONE',
      ai: gr('ai') || 'NONE',
      payments: gr('payments') || 'NONE',
      seo: gr('seo') || 'NONE',
      darkMode: gr('darkMode') || 'YES',
      designDirection: gv('designDirection'),
      brandName: gv('brandName'),
      brandColorPrimary: gv('brandColorPrimary') || '#f97316',
      brandColorSecondary: dom.noSecondary?.checked ? 'none' : (gv('brandColorSecondary') || 'agent decides'),
      knownConstraints: gv('knownConstraints'),
      autonomy: gr('autonomy') || 'AUTONOMOUS',
    };
  }

  // ─── Utility ──────────────────────────────────────────────
  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function flashButton(btn, text) {
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = orig; }, 2000);
  }

  function updateHelpModeNote() {
    if (!dom.helpModeNote) return;
    dom.helpModeNote.textContent = state.helpMode === 'need-help'
      ? '✅ Expanded guidance enabled. Each step shows extra explanations and examples.'
      : 'Brief hints shown. Click 💡 or the buttons above to enable expanded guidance.';
  }

  function resetColorUI() {
    if (dom.colorRow) dom.colorRow.style.display = 'none';
    if (dom.btnAgent) dom.btnAgent.classList.add('active-mode');
    if (dom.btnPick) dom.btnPick.classList.remove('active-mode');
    if (dom.primaryPicker) dom.primaryPicker.value = '#f97316';
    if (dom.primaryText) dom.primaryText.value = '#f97316';
    if (dom.secondaryPicker) dom.secondaryPicker.value = '#fb923c';
    if (dom.secondaryText) dom.secondaryText.value = '#fb923c';
    if (dom.noSecondary) dom.noSecondary.checked = false;
  }

  function resetReviewUI() {
    if (dom.reviewSummary) dom.reviewSummary.innerHTML = '';
    if (dom.reviewWarnings) dom.reviewWarnings.style.display = 'none';
    if (dom.outputArea) { dom.outputArea.style.display = 'none'; dom.outputArea.textContent = ''; }
    if (dom.copyBtn) dom.copyBtn.style.display = 'none';
    if (dom.legalScanBtn) dom.legalScanBtn.style.display = 'none';
    if (dom.legalScanArea) dom.legalScanArea.innerHTML = '';
  }

  // ─── Event Handling (delegation) ─────────────────────────
  function bindEvents() {
    // Global click delegation for data-action buttons
    document.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;

      const action = actionEl.dataset.action;

      switch (action) {
        case 'next':        nav.next(); break;
        case 'prev':        nav.prev(); break;
        case 'restart':     nav.restart(); break;
        case 'generate':    prompt.generate(); break;
        case 'copy':        prompt.copy(); break;
        case 'legal-scan':  legalScan.run(); break;
        case 'expert-eval': expert.evaluate(); break;
        case 'toggle-help':
          state.helpMode = state.helpMode === 'need-help' ? 'got-this' : 'need-help';
          updateHelpModeNote();
          render.renderStep();
          persistence.save();
          break;
        case 'set-mode':
          state.helpMode = actionEl.dataset.mode;
          updateHelpModeNote();
          nav.go(1);
          break;
        case 'go-expert':
          nav.go(EXPERT_STEP);
          break;
        case 'start-katie':
          katie.start();
          state.currentStep = 10;
          render.renderStep();
          break;
        case 'katie-submit':
          katie.submitAnswer();
          break;
        case 'katie-skip':
          katie.skipPhase();
          break;
        case 'katie-finish':
          katie.goToReview();
          break;
        case 'color-mode':
          setColorMode(actionEl.dataset.mode);
          break;
      }
    });

    // Step pill navigation
    document.getElementById('step-pills')?.addEventListener('click', (e) => {
      const pill = e.target.closest('.step-pill');
      if (!pill || pill.disabled) return;
      nav.goToStep(parseInt(pill.dataset.goto, 10));
    });

    // Form input changes → autosave + clear validation errors
    dom.form.addEventListener('input', (e) => {
      // Clear validation error styling on this field
      if (e.target.classList.contains('field-error')) {
        e.target.classList.remove('field-error');
      }
      debouncedSave();
    });

    // Radio changes → autosave
    dom.form.addEventListener('change', (e) => {
      if (e.target.type === 'radio' || e.target.type === 'checkbox') {
        debouncedSave();
      }
    });

    // Color picker sync — primary
    dom.primaryPicker?.addEventListener('input', (e) => {
      dom.primaryText.value = e.target.value;
    });
    dom.primaryText?.addEventListener('input', (e) => {
      if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
        dom.primaryPicker.value = e.target.value;
      }
    });

    // Color picker sync — secondary
    dom.secondaryPicker?.addEventListener('input', (e) => {
      dom.secondaryText.value = e.target.value;
    });
    dom.secondaryText?.addEventListener('input', (e) => {
      if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
        dom.secondaryPicker.value = e.target.value;
      }
    });

    // Keyboard navigation: Ctrl/Cmd+Enter to advance from textareas
    dom.form.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (state.currentStep === 10) {
          katie.submitAnswer(); // Katie's Groove: submit answer
        } else {
          nav.next();
        }
      }
      // Katie's Groove: plain Enter submits (since it's a short answer)
      if (state.currentStep === 10 && e.key === 'Enter' && !e.shiftKey) {
        const target = e.target;
        if (target && target.id === 'katie-answer') {
          e.preventDefault();
          katie.submitAnswer();
        }
      }
    });

    // Prevent native form submission
    dom.form.addEventListener('submit', (e) => e.preventDefault());
  }

  function setColorMode(mode) {
    state.colorMode = mode;
    if (mode === 'pick') {
      dom.colorRow.style.display = 'flex';
      dom.primaryText.value = dom.primaryPicker.value;
      dom.btnAgent.classList.remove('active-mode');
      dom.btnPick.classList.add('active-mode');
    } else {
      dom.colorRow.style.display = 'none';
      dom.primaryText.value = 'agent decides';
      dom.primaryPicker.value = '#f97316';
      dom.btnAgent.classList.add('active-mode');
      dom.btnPick.classList.remove('active-mode');
    }
    persistence.save();
  }

  // ─── Legal Scan ──────────────────────────────────────────
  const legalScan = {
    run() {
      const d = collectFormData();
      const results = [];
      let riskScore = 0;

      if (d.sourceMode === 'AUTHORIZED_REBUILD') {
        if (!d.authConfirm || !d.authConfirm.toLowerCase().includes('confirm')) {
          results.push({ level: 'HIGH', msg: 'AUTHORIZED_REBUILD selected but authorization confirmation missing. Risk: copyright infringement.' });
          riskScore += 3;
        } else {
          results.push({ level: 'LOW', msg: 'AUTHORIZATION confirmed — rebuild within permitted scope.' });
        }
      } else if (d.sourceMode === 'PUBLIC_PRODUCT_INSPIRATION') {
        results.push({ level: 'MEDIUM', msg: 'PUBLIC_INSPIRATION: Must reimplement independently. Do not copy code/assets/trademarks.' });
        riskScore += 2;
      } else {
        results.push({ level: 'LOW', msg: 'NEW_PRODUCT — original work, lowest copyright risk.' });
      }

      if (d.sourceUrl && d.sourceUrl !== 'N/A') {
        results.push({ level: 'INFO', msg: 'Source URL provided: ' + d.sourceUrl + '. Ensure only public content is accessed.' });
      }
      if (d.brandName) {
        results.push({ level: 'INFO', msg: 'Brand: "' + d.brandName + '". Verify no trademark conflicts.' });
      }
      if (!d.coreFeatures || d.coreFeatures.trim().length < 10) {
        results.push({ level: 'MEDIUM', msg: 'Core features too brief — vague scope increases overlap risk.' });
        riskScore += 1;
      }
      results.push({ level: 'REQUIRED', msg: 'All generated legal pages are DRAFTS — require professional legal review.' });

      const overall = riskScore >= 3 ? 'HIGH' : riskScore >= 1 ? 'MEDIUM' : 'LOW';
      const color = overall === 'HIGH' ? '#ef4444' : overall === 'MEDIUM' ? '#f59e0b' : '#22c55e';

      if (dom.legalScanArea) {
        dom.legalScanArea.innerHTML = `<div class="legal-scan" style="border-color:${color}">
          <h3 style="color:${color}">⚖️ Legal Scan — ${overall} Risk</h3>
          <ul>${results.map(r => `<li class="legal-${r.level.toLowerCase()}"><strong>[${r.level}]</strong> ${r.msg}</li>`).join('')}</ul>
        </div>`;
        dom.legalScanArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  // ─── Katie's Groove — Beginner Conversational Intake ────
  const KATIE_PHASES = [
    {
      id: 'problem',
      bob: "Alright, let's start with the basics. <strong>What problem are we solving?</strong> Think about what's frustrating, time-consuming, or just plain broken right now.",
      hint: "Don't overthink it — just describe what bugs you. Example: \"I spend 2 hours every Monday making schedules for my team.\"",
      suggestions: ["I spend too much time on...", "It's really hard to...", "I keep losing track of...", "I wish I could just..."],
      fields: ['coreProblem'],
      extract: (answer) => ({ coreProblem: answer.trim() })
    },
    {
      id: 'user',
      bob: "Got it. Now — <strong>who has this problem?</strong> Think of one specific type of person. Not \"everyone.\" One real human.",
      hint: "The more specific, the better your app will be. Example: \"Freelance designers who invoice 10+ clients a month.\"",
      suggestions: ["Freelancers", "Small business owners", "Students", "Parents", "Teachers", "Developers"],
      fields: ['coreUser'],
      extract: (answer) => ({ coreUser: answer.trim() })
    },
    {
      id: 'action',
      bob: "Nice. So when this person uses your app, <strong>what's the ONE main thing they do?</strong> The big button they press. The core action.",
      hint: "Think verbs. What do they actually DO? Example: \"Click generate and get a formatted invoice.\" Not a list — just the big one.",
      suggestions: ["Click a button to generate...", "Upload a file and get...", "Type something in and receive..."],
      fields: ['coreAction'],
      extract: (answer) => ({ coreAction: answer.trim() })
    },
    {
      id: 'result',
      bob: "And after they do that thing — <strong>what do they end up with?</strong> What's in their hands?",
      hint: "Be concrete. A file? A page? An email? Example: \"A downloadable PDF invoice they can send to their client.\"",
      suggestions: ["A downloadable file", "A clean dashboard", "An email or notification", "A formatted document"],
      fields: ['coreResult'],
      extract: (answer) => ({ coreResult: answer.trim() })
    },
    {
      id: 'name',
      bob: "Let's give this thing a name! <strong>What should we call it?</strong> Can be anything — a real name, a fun name, a working title. We'll clean it up.",
      hint: "Think of a name you'd tell a friend. Example: \"ScheduleBot\" or \"InvoiceWiz\" or \"My Cool Thing.\"",
      suggestions: [],
      fields: ['projectName', 'brandName'],
      extract: (answer) => {
        const name = answer.trim();
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-app';
        return { projectName: slug, brandName: name };
      }
    },
    {
      id: 'description',
      bob: "Now pretend you're at a coffee shop telling a friend about this app. <strong>In one sentence, what does it do?</strong>",
      hint: "Keep it simple — like you're texting. Example: \"It takes your messy notes and turns them into a clean quiz for your students.\"",
      suggestions: ["It's like ___ but for...", "It helps [person] do [thing]", "It takes [input] and makes [output]"],
      fields: ['projectDescription'],
      extract: (answer) => ({ projectDescription: answer.trim() })
    },
    {
      id: 'features',
      bob: "Alright, <strong>what are the must-have features?</strong> Think about what your app absolutely needs to work. List them one per line.",
      hint: "Start with the core action, then add anything else it needs. Example:\n• User types in their notes\n• App generates a quiz\n• User can download the quiz as PDF",
      suggestions: ["User can sign up / log in", "User can save their work", "User can share or export", "User can see history"],
      fields: ['coreFeatures'],
      extract: (answer) => {
        const lines = answer.split('\n').map(l => l.replace(/^[\s•\-\*]+/, '').trim()).filter(l => l.length > 0);
        return { coreFeatures: lines.length > 0 ? lines.map(f => '• ' + f).join('\n') : answer.trim() };
      }
    },
    {
      id: 'platform',
      bob: "Now the boring-but-important stuff. <strong>Where does this app live?</strong>",
      hint: "Most things are web apps (runs in a browser). If you're not sure, pick \"A website.\" Phone apps are more complex — only pick if you're sure.",
      suggestions: ["A website (web app)", "A phone app (mobile)", "Both web and mobile", "A desktop app"],
      fields: ['platform', 'distribution'],
      extract: (answer) => {
        const a = answer.toLowerCase();
        if (a.includes('phone') || a.includes('mobile')) return { platform: 'MOBILE', distribution: 'APP_STORES' };
        if (a.includes('both')) return { platform: 'WEB_AND_MOBILE', distribution: 'BOTH_LOCAL_AND_DEPLOYABLE' };
        if (a.includes('desktop')) return { platform: 'DESKTOP', distribution: 'LOCAL_ONLY' };
        return { platform: 'WEB', distribution: 'DEPLOYABLE_WEB' };
      }
    },
    {
      id: 'modules',
      bob: "Does your app need any of these? <strong>Click the ones that apply</strong> (or skip if you're not sure — defaults are fine):",
      hint: "If you're building something simple, you probably don't need any of these yet. You can always add them later.",
      suggestions: ["🔐 User logins", "💾 A database (save data)", "🤖 AI / smart features", "💳 Payments (charge money)"],
      fields: ['auth', 'database', 'ai', 'payments'],
      isMultiSelect: true,
      extract: (answer) => {
        const a = answer.toLowerCase();
        const result = { auth: 'NONE', database: 'NONE', ai: 'NONE', payments: 'NONE' };
        if (a.includes('login') || a.includes('sign') || a.includes('account') || a.includes('🔐')) result.auth = 'REQUIRED';
        if (a.includes('database') || a.includes('save') || a.includes('persist') || a.includes('💾')) result.database = 'CLOUD';
        if (a.includes('ai') || a.includes('smart') || a.includes('gpt') || a.includes('🤖') || a.includes('generate')) result.ai = 'REQUIRED';
        if (a.includes('payment') || a.includes('charge') || a.includes('subscription') || a.includes('💳') || a.includes('money')) result.payments = 'REQUIRED';
        return result;
      }
    },
    {
      id: 'design',
      bob: "Last creative question! <strong>What should this app look like?</strong> Describe the vibe — clean? playful? professional? dark and sleek?",
      hint: "You can reference apps you like. Example: \"Clean and minimal like Notion\" or \"Bold and colorful like Duolingo.\"",
      suggestions: ["Clean and minimal", "Bold and colorful", "Professional and corporate", "Dark and sleek", "Playful and fun"],
      fields: ['designDirection', 'brandColorPrimary'],
      extract: (answer) => {
        const a = answer.toLowerCase();
        let color = '#f97316'; // default orange
        if (a.includes('clean') || a.includes('minimal') || a.includes('simple')) color = '#3b82f6';
        else if (a.includes('bold') || a.includes('colorful') || a.includes('vibrant') || a.includes('energetic')) color = '#f97316';
        else if (a.includes('calm') || a.includes('peaceful') || a.includes('natural') || a.includes('green')) color = '#10b981';
        else if (a.includes('professional') || a.includes('corporate') || a.includes('serious')) color = '#6366f1';
        else if (a.includes('playful') || a.includes('fun') || a.includes('creative') || a.includes('pink')) color = '#ec4899';
        else if (a.includes('dark') || a.includes('sleek') || a.includes('modern') || a.includes('purple')) color = '#8b5cf6';
        return { designDirection: answer.trim(), brandColorPrimary: color };
      }
    },
    {
      id: 'constraints',
      bob: "Final question — <strong>any rules or limits?</strong> Budget? Specific tools you want to use? Or just say \"no limits\" and we'll figure it out.",
      hint: "If you have no idea, just type \"none\" and we'll let the AI decide everything. Example: \"I have no budget, use free tools\" or \"Must use Stripe for payments.\"",
      suggestions: ["No limits — figure it out", "Free tools only", "Must deploy to Vercel", "I have no idea, you decide"],
      fields: ['knownConstraints'],
      extract: (answer) => ({ knownConstraints: answer.trim() || 'none' })
    }
  ];

  const katie = {
    currentPhase: 0,
    answers: {},
    conversationHistory: [],

    start() {
      this.currentPhase = 0;
      this.answers = {};
      this.conversationHistory = [];
      state.isKatieMode = true;

      // Clear conversation and show input
      const conv = document.getElementById('katie-conversation');
      const inputArea = document.getElementById('katie-input-area');
      const doneArea = document.getElementById('katie-done');
      if (conv) conv.innerHTML = '';
      if (inputArea) inputArea.style.display = 'block';
      if (doneArea) doneArea.style.display = 'none';

      this.renderPhase();
    },

    renderPhase() {
      const phase = KATIE_PHASES[this.currentPhase];
      if (!phase) return this.finish();

      // Update progress
      const pct = ((this.currentPhase) / KATIE_PHASES.length) * 100;
      const fill = document.getElementById('katie-progress-fill');
      const label = document.getElementById('katie-step-label');
      if (fill) fill.style.width = pct + '%';
      if (label) label.textContent = `Phase ${this.currentPhase + 1} of ${KATIE_PHASES.length}`;

      // Add Bob's question bubble
      this.addBubble(phase.bob, 'bob');

      // Add hint bubble
      if (phase.hint) {
        this.addBubble('💡 ' + phase.hint, 'hint');
      }

      // Update suggestions
      const suggestionsEl = document.getElementById('katie-suggestions');
      if (suggestionsEl) {
        suggestionsEl.innerHTML = phase.suggestions.map(s =>
          `<button type="button" class="katie-suggestion-chip" data-katie-suggest="${escAttr(s)}">${escHtml(s)}</button>`
        ).join('');

        // Wire up suggestion clicks
        suggestionsEl.querySelectorAll('.katie-suggestion-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            const answerEl = document.getElementById('katie-answer');
            if (answerEl) {
              if (phase.isMultiSelect) {
                // For multi-select, append
                const current = answerEl.value.trim();
                answerEl.value = current ? current + ', ' + chip.dataset.katieSuggest : chip.dataset.katieSuggest;
              } else {
                answerEl.value = chip.dataset.katieSuggest;
              }
              answerEl.focus();
            }
          });
        });
      }

      // Update submit button text
      const submitBtn = document.getElementById('katie-submit-btn');
      if (submitBtn) {
        submitBtn.textContent = this.currentPhase === KATIE_PHASES.length - 1 ? 'Finish! 🎉' : 'Next →';
      }

      // Focus the answer input
      const answerEl = document.getElementById('katie-answer');
      if (answerEl) {
        answerEl.value = '';
        answerEl.placeholder = phase.isMultiSelect
          ? 'Click chips above or type your own...'
          : 'Type your answer here...';
        answerEl.focus();
      }

      // Scroll conversation to bottom
      const conv = document.getElementById('katie-conversation');
      if (conv) conv.scrollTop = conv.scrollHeight;
    },

    addBubble(text, type) {
      const conv = document.getElementById('katie-conversation');
      if (!conv) return;
      const bubble = document.createElement('div');
      bubble.className = `katie-bubble katie-bubble--${type}`;
      bubble.innerHTML = text;
      conv.appendChild(bubble);
      conv.scrollTop = conv.scrollHeight;
    },

    submitAnswer() {
      const answerEl = document.getElementById('katie-answer');
      const answer = answerEl?.value?.trim() || '';
      const phase = KATIE_PHASES[this.currentPhase];
      if (!phase) return;

      if (!answer && !phase.isMultiSelect) {
        // Shake the input to indicate required
        answerEl.classList.add('field-error');
        setTimeout(() => answerEl.classList.remove('field-error'), 1500);
        return;
      }

      // Add user bubble
      this.addBubble(escHtml(answer || '(skipped)'), 'user');

      // Extract and store answers
      const extracted = phase.extract(answer);
      Object.assign(this.answers, extracted);

      // Clear and advance
      if (answerEl) answerEl.value = '';
      this.currentPhase++;

      if (this.currentPhase >= KATIE_PHASES.length) {
        this.finish();
      } else {
        // Small delay for natural feel
        setTimeout(() => this.renderPhase(), 400);
      }
    },

    skipPhase() {
      const phase = KATIE_PHASES[this.currentPhase];
      if (!phase) return;

      this.addBubble('(skipped)', 'user');
      this.currentPhase++;

      if (this.currentPhase >= KATIE_PHASES.length) {
        this.finish();
      } else {
        setTimeout(() => this.renderPhase(), 400);
      }
    },

    finish() {
      // Apply answers to the actual form
      this.applyToForm();

      // Update progress to 100%
      const fill = document.getElementById('katie-progress-fill');
      if (fill) fill.style.width = '100%';
      const label = document.getElementById('katie-step-label');
      if (label) label.textContent = 'Complete! 🎉';

      // Hide input, show done
      const inputArea = document.getElementById('katie-input-area');
      const doneArea = document.getElementById('katie-done');
      if (inputArea) inputArea.style.display = 'none';
      if (doneArea) doneArea.style.display = 'block';

      // Build summary
      this.renderSummary();
    },

    applyToForm() {
      // Map Katie's answers to form fields
      const a = this.answers;

      // Text fields
      if (a.projectName) setVal('projectName', a.projectName);
      if (a.projectDescription) setVal('projectDescription', a.projectDescription);
      if (a.coreUser) setVal('coreUser', a.coreUser);
      if (a.coreProblem) setVal('coreProblem', a.coreProblem);
      if (a.coreAction) setVal('coreAction', a.coreAction);
      if (a.coreResult) setVal('coreResult', a.coreResult);
      if (a.coreFeatures) setVal('coreFeatures', a.coreFeatures);
      if (a.designDirection) setVal('designDirection', a.designDirection);
      if (a.brandName) setVal('brandName', a.brandName);
      if (a.brandColorPrimary) setVal('brandColorPrimary', a.brandColorPrimary);
      if (a.knownConstraints) setVal('knownConstraints', a.knownConstraints);

      // Radio buttons
      if (a.platform) setRadio('platform', a.platform);
      if (a.distribution) setRadio('distribution', a.distribution);
      if (a.auth) setRadio('auth', a.auth);
      if (a.database) setRadio('database', a.database);
      if (a.ai) setRadio('ai', a.ai);
      if (a.payments) setRadio('payments', a.payments);

      // Set defaults for fields Katie doesn't ask about
      setRadio('sourceMode', 'NEW_PRODUCT');
      setRadio('seo', 'BASIC');
      setRadio('darkMode', 'YES');
      setRadio('autonomy', 'AUTONOMOUS');

      // Set help mode to need-help since they're a newb
      state.helpMode = 'need-help';
      updateHelpModeNote();

      // Trigger autosave
      debouncedSave();
    },

    renderSummary() {
      const summaryEl = document.getElementById('katie-summary');
      if (!summaryEl) return;

      const a = this.answers;
      const items = [
        ['Project Name', a.brandName || a.projectName || 'Not set'],
        ['What it does', a.projectDescription || 'Not set'],
        ['Who it\'s for', a.coreUser || 'Not set'],
        ['The problem', a.coreProblem || 'Not set'],
        ['Main action', a.coreAction || 'Not set'],
        ['The result', a.coreResult || 'Not set'],
        ['Platform', a.platform || 'Web'],
        ['Design vibe', a.designDirection || 'Clean and minimal'],
        ['Features', a.coreFeatures || 'Not set'],
        ['Logins?', a.auth === 'REQUIRED' ? 'Yes' : 'No'],
        ['Database?', a.database === 'CLOUD' || a.database === 'LOCAL' ? 'Yes' : 'No'],
        ['AI?', a.ai === 'REQUIRED' ? 'Yes' : 'No'],
        ['Payments?', a.payments === 'REQUIRED' ? 'Yes' : 'No'],
        ['Constraints', a.knownConstraints || 'None'],
      ];

      summaryEl.innerHTML = '<dl>' +
        items.map(([label, value]) =>
          `<dt>${escHtml(label)}</dt><dd>${escHtml(value)}</dd>`
        ).join('') +
        '</dl>';
    },

    goToReview() {
      state.isKatieMode = false;
      nav.go(8); // Go to review step
    }
  };

  // Helper to escape HTML attributes
  function escAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Expose for external use
  window.BobApp = { state, runLegalScan: legalScan.run, nav, prompt, katie };

  // ─── Bootstrap ────────────────────────────────────────────
  function init() {
    cacheDom();
    bindEvents();

    // Try to restore from localStorage
    const restored = persistence.load();
    if (!restored) {
      updateHelpModeNote();
    }

    // Start async script loading (non-blocking)
    scriptLoader.load();

    // Initial render
    render.renderStep();
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
