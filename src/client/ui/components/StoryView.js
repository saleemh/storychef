const blessed = require('blessed');

/**
 * StoryView - Main story display area
 * 
 * Shows:
 * - Story content (scrollable)
 * - Recent player inputs (bottom section)
 * - Visual separator between sections
 */
class StoryView {
  constructor() {
    // Main container
    this.container = blessed.box({
      top: 3,
      left: 0,
      width: '100%',
      bottom: 3,  // Leave space for input bar at bottom
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'white'
        }
      }
    });

    // Story content area (scrollable)
    this.storyBox = blessed.box({
      parent: this.container,
      top: 0,
      left: 0,
      width: '100%',
      height: '75%',
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
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
      tags: true,
      padding: {
        left: 1,
        right: 1
      }
    });

    // Separator line
    this.separator = blessed.line({
      parent: this.container,
      top: '75%',
      left: 0,
      width: '100%',
      orientation: 'horizontal',
      style: {
        fg: 'cyan',
        type: 'line'
      }
    });

    // Recent inputs area
    this.inputsBox = blessed.box({
      parent: this.container,
      top: '75%+1',
      left: 0,
      width: '100%',
      height: '25%-1',
      scrollable: true,
      mouse: true,
      keys: true,
      tags: true,
      padding: {
        left: 1,
        right: 1
      },
      label: ' Recent Inputs ',
      border: {
        type: 'line',
        top: false,
        bottom: false,
        left: false,
        right: false
      },
      style: {
        label: {
          fg: 'cyan'
        }
      }
    });
  }

  getElement() {
    return this.container;
  }

  render(uiState) {
    // Update story content
    const storyText = uiState.getFullStory();
    if (storyText) {
      this.storyBox.setContent(this.formatStory(storyText));
      // Auto-scroll to bottom when new content is added
      this.storyBox.setScrollPerc(100);
    } else {
      // Show placeholder when no story yet
      if (uiState.isInSeedingPhase()) {
        this.storyBox.setContent('{center}{yellow-fg}📝 Story seeding in progress...{/yellow-fg}{/center}\n\n{center}Players are creating the foundation of your collaborative story.{/center}');
      } else {
        this.storyBox.setContent('{center}{white-fg}Your story will appear here...{/white-fg}{/center}');
      }
    }

    // Update recent inputs
    const recentInputs = uiState.getRecentInputs();
    if (recentInputs.length > 0) {
      const inputsText = recentInputs
        .map((input, index) => this.formatInput(input, index))
        .join('\n');
      this.inputsBox.setContent(inputsText);
    } else {
      this.inputsBox.setContent('{white-fg}No inputs yet...{/white-fg}');
    }
  }

  formatStory(text) {
    // Add some formatting to make the story more readable
    const paragraphs = text.split(/\n\n+/);
    
    return paragraphs
      .map(paragraph => {
        // Wrap long lines
        return this.wrapText(paragraph.trim(), this.storyBox.width - 4);
      })
      .filter(p => p.length > 0)
      .join('\n\n');
  }

  formatInput(input, index) {
    // Parse input format: "PlayerName [TYPE]: content"
    const match = input.match(/^(.+?) \[(SEED|DIRECT|INFLUENCE)\]: (.+)$/);
    
    if (match) {
      const [, playerName, inputType, content] = match;
      const typeColor = this.getInputTypeColor(inputType);
      const timestamp = new Date().toLocaleTimeString();
      
      return `{cyan-fg}${playerName}{/cyan-fg} {${typeColor}-fg}[${inputType}]{/${typeColor}-fg}: ${content}`;
    }
    
    // Fallback for non-standard format
    return `{white-fg}${input}{/white-fg}`;
  }

  getInputTypeColor(type) {
    switch (type) {
      case 'SEED': return 'yellow';
      case 'DIRECT': return 'green';
      case 'INFLUENCE': return 'magenta';
      default: return 'white';
    }
  }

  wrapText(text, maxWidth) {
    if (!text || maxWidth <= 0) return text;
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      // Simple length check (doesn't account for tags, but good enough)
      if (testLine.length > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is too long, force break it
          lines.push(word.substring(0, maxWidth));
          currentLine = word.substring(maxWidth);
        }
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.join('\n');
  }

  focus() {
    this.storyBox.focus();
  }

  scrollUp() {
    this.storyBox.scroll(-1);
  }

  scrollDown() {
    this.storyBox.scroll(1);
  }

  scrollToTop() {
    this.storyBox.setScrollPerc(0);
  }

  scrollToBottom() {
    this.storyBox.setScrollPerc(100);
  }

  hide() {
    this.container.hide();
  }

  show() {
    this.container.show();
  }
}

module.exports = StoryView;
