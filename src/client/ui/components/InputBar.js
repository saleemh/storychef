const blessed = require('blessed');

/**
 * InputBar - Bottom input component for user text entry
 * 
 * Handles both story seeding and dual-mode input (Direct/Influence)
 */
class InputBar {
  constructor(getLabelsFn, onSubmitFn) {
    this.getLabels = getLabelsFn; // () => { modeText, label }
    this.onSubmit = onSubmitFn;   // async (text) => result
    
    this.input = blessed.textbox({
      parent: null,
      top: '70%+3',
      left: 0,
      width: '100%',
      height: 3,
      border: { type: 'line' },
      keys: true,
      mouse: true,
      inputOnFocus: true,
      label: ' Input ',
      style: {
        border: { fg: 'cyan' },
        focus: { border: { fg: 'green' } }
      }
    });

    // Submit handler - only attach once
    this.input.on('submit', async (value) => {
      const text = String(value || '').trim();
      if (!text) {
        this.clearAndRefocus();
        return;
      }
      
      try {
        await this.onSubmit(text);
      } finally {
        this.clearAndRefocus();
      }
    });

    // Additional enter key handler for some terminals
    this.input.key(['enter'], () => {
      // Only submit if not already submitting
      if (!this.input._submitting) {
        this.input._submitting = true;
        this.input.submit();
        setTimeout(() => {
          this.input._submitting = false;
        }, 100);
      }
    });
  }

  getElement() {
    return this.input;
  }

  focus() {
    // Just focus, don't call readInput as inputOnFocus handles it
    this.input.focus();
  }

  clear() {
    this.input.clearValue();
    this.input.setValue('');
  }

  clearAndRefocus() {
    this.clear();
    // Small delay before refocus to avoid input handling conflicts
    setTimeout(() => {
      this.focus();
    }, 10);
  }

  render(uiState) {
    const labels = this.getLabels(uiState);
    this.input.setLabel(` [${labels.modeText}] ${labels.label} `);
  }

  destroy() {
    this.input.removeAllListeners();
  }
}

module.exports = InputBar;