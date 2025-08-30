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
      right: 0,  // Use right anchor instead of width
      bottom: 3, // Use bottom anchor instead of height calculation
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'white'
        }
      },
      tags: false
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
        left: 0,
        right: 1
      },
      // No label - we'll add it as content
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
    let content = '{bold}Recent Inputs{/bold}\n';
    
    if (recentInputs.length > 0) {
      const inputsText = recentInputs
        .map((input, index) => this.formatInput(input, index))
        .join('\n');
      content += inputsText;
    } else {
      content += '{white-fg}No inputs yet...{/white-fg}';
    }
    
    this.inputsBox.setContent(content);
  }

  formatStory(text) {
    // Add some formatting to make the story more readable
    const paragraphs = text.split(/\n\n+/);
    
    return paragraphs
      .map((paragraph, index) => {
        const wrappedText = this.wrapText(paragraph.trim(), this.storyBox.width - 4);
        
        // Make the last (most recent) paragraph bold
        if (index === paragraphs.length - 1 && paragraphs.length > 1) {
          return `{bold}${wrappedText}{/bold}`;
        }
        
        return wrappedText;
      })
      .filter(p => p.length > 0)
      .join('\n\n');
  }

  formatInput(input, index) {
    // Handle new input format with timestamp object
    const inputText = input.text || input;
    const timestamp = input.timestamp || new Date();
    
    // Parse input format: "PlayerName [TYPE]: content"
    const match = inputText.match(/^(.+?) \[(SEED|DIRECT|INFLUENCE)\]: (.+)$/);
    
    if (match) {
      const [, playerName, inputType, content] = match;
      const typeColor = this.getInputTypeColor(inputType);
      const timeStr = this.formatTimestamp(timestamp);
      
      // Format: 4:35pm [influence] samoda-mac: content
      return `{gray-fg}${timeStr}{/gray-fg} {${typeColor}-fg}[${inputType.toLowerCase()}]{/${typeColor}-fg} {cyan-fg}${playerName.toLowerCase()}{/cyan-fg}: ${content}`;
    }
    
    // Fallback for non-standard format
    return `{white-fg}${inputText}{/white-fg}`;
  }

  formatTimestamp(timestamp) {
    const now = new Date(timestamp);
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }).toLowerCase();
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
