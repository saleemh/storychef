const blessed = require('blessed');

/**
 * Modal - Reusable modal dialog component
 * 
 * Used for:
 * - Help dialog
 * - Goals display (competition mode)
 * - Error messages
 * - Confirmations
 */
class Modal {
  constructor(title = 'Modal', width = 60, height = 20) {
    // Semi-transparent background overlay
    this.overlay = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      style: {
        bg: 'black',
        transparent: true
      },
      hidden: true
    });

    // Modal dialog box
    this.dialog = blessed.box({
      parent: this.overlay,
      top: 'center',
      left: 'center',
      width: width,
      height: height,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        },
        bg: 'black',
        fg: 'white'
      },
      label: title,
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█',
        track: {
          bg: 'black'
        },
        style: {
          inverse: false,
          bg: 'white',
          fg: 'black'
        }
      },
      padding: {
        top: 1,
        bottom: 1,
        left: 2,
        right: 2
      }
    });

    // Focus handling
    this.dialog.key(['escape', 'q', 'enter', 'space'], () => {
      this.hide();
    });

    // Click outside to close
    this.overlay.on('click', () => {
      this.hide();
    });

    // Prevent click propagation from dialog
    this.dialog.on('click', (data) => {
      data.stopPropagation();
    });

    this.onHide = null;
  }

  getElement() {
    return this.overlay;
  }

  show(content, options = {}) {
    if (options.title) {
      this.dialog.setLabel(` ${options.title} `);
    }

    if (options.width) {
      this.dialog.width = options.width;
    }

    if (options.height) {
      this.dialog.height = options.height;
    }

    this.dialog.setContent(content);
    this.overlay.show();
    this.dialog.focus();
    
    // Ensure modal is rendered on top
    this.overlay.setFront();
    
    // Re-render the screen
    if (this.overlay.screen) {
      this.overlay.screen.render();
    }
  }

  hide() {
    this.overlay.hide();
    
    if (this.onHide) {
      this.onHide();
    }

    if (this.overlay.screen) {
      this.overlay.screen.render();
    }
  }

  isVisible() {
    return !this.overlay.hidden;
  }

  setOnHide(callback) {
    this.onHide = callback;
  }

  focus() {
    if (!this.overlay.hidden) {
      this.dialog.focus();
    }
  }

  // Utility methods for common modal types
  
  showError(message) {
    const content = `{center}{red-fg}❌ ERROR{/red-fg}{/center}\n\n${message}\n\n{center}Press any key to dismiss{/center}`;
    this.show(content, {
      title: 'Error',
      width: 50,
      height: 10
    });
  }

  showSuccess(message) {
    const content = `{center}{green-fg}✅ SUCCESS{/green-fg}{/center}\n\n${message}\n\n{center}Press any key to dismiss{/center}`;
    this.show(content, {
      title: 'Success',
      width: 50,
      height: 10
    });
  }

  showInfo(title, message) {
    const content = `${message}\n\n{center}Press any key to dismiss{/center}`;
    this.show(content, {
      title: title,
      width: 60,
      height: 15
    });
  }

  showConfirm(message, onConfirm, onCancel) {
    const content = `${message}\n\n{center}[Y]es    [N]o{/center}`;
    
    this.show(content, {
      title: 'Confirm',
      width: 40,
      height: 10
    });

    // Remove existing key handlers
    this.dialog.removeAllListeners('keypress');

    // Add confirm/cancel handlers
    const keyHandler = (ch, key) => {
      if (key.name === 'y') {
        this.hide();
        if (onConfirm) onConfirm();
      } else if (key.name === 'n' || key.name === 'escape') {
        this.hide();
        if (onCancel) onCancel();
      }
    };

    this.dialog.on('keypress', keyHandler);
  }

  destroy() {
    try {
      this.dialog.removeAllListeners();
      this.overlay.removeAllListeners();
      if (this.overlay.parent) {
        this.overlay.detach();
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
}

module.exports = Modal;
