const blessed = require('blessed');

class InputBar {
  constructor(getLabelsFn, onSubmitFn) {
    this.getLabels = getLabelsFn; // () => { modeText, label }
    this.onSubmit = onSubmitFn;   // async (text) => result

    this.input = blessed.textbox({
      top: '70%+3',
      left: 0,
      width: '100%',
      height: 3,
      border: { type: 'line' },
      keys: true,
      mouse: true,
      inputOnFocus: true,
      label: ' Input '
    });

    // Submit handler
    this.input.on('submit', async (value) => {
      const text = String(value || '').trim();
      if (!text) { this.clear(); return; }
      try {
        await this.onSubmit(text);
      } finally {
        this.clear();
      }
    });

    // Enter key to trigger submit explicitly (some terminals)
    this.input.key(['enter'], () => {
      this.input.submit();
    });
  }

  getElement() {
    return this.input;
  }

  focus() {
    // Ensure textbox is in read mode on focus to prevent terminal echo side-effects
    this.input.focus();
    if (typeof this.input.readInput === 'function') {
      this.input.readInput(() => {});
    }
  }

  clear() {
    this.input.clearValue();
    this.input.setValue('');
    this.focus();
  }

  render(uiState) {
    const labels = this.getLabels(uiState);
    this.input.setLabel(` [${labels.modeText}] ${labels.label} `);
  }
}

module.exports = InputBar;
