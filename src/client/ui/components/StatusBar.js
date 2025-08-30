const blessed = require('blessed');
const Utils = require('../../../shared/utils');

/**
 * StatusBar - Top status bar showing game information
 * 
 * Displays:
 * - Session ID
 * - Time remaining
 * - Current phase (SEEDING/STORY/COMPLETE)
 * - Player count
 * - Status messages
 */
class StatusBar {
  constructor() {
    this.box = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      },
      tags: true
    });

    this.content = '';
  }

  getElement() {
    return this.box;
  }

  render(uiState) {
    const session = uiState.getSession();
    const message = uiState.getMessage();
    
    if (!session) {
      this.box.setContent('{center}🌟 Story Chef - Not Connected 🌟{/center}');
      return;
    }

    // Build status line components
    const components = [];
    
    // Session ID
    components.push(`{cyan-fg}${session.sessionId}{/cyan-fg}`);
    
    // Phase
    const phase = uiState.getPhaseText();
    const phaseColor = this.getPhaseColor(phase);
    components.push(`{${phaseColor}-fg}${phase}{/${phaseColor}-fg}`);
    
    // Story time remaining (overall story timer)
    if (uiState.isStoryActive()) {
      const storyTimeStr = Utils.formatTime(uiState.getTimeRemaining());
      const storyTimeColor = uiState.getTimeRemaining() < 60000 ? 'red' : 'green';
      components.push(`{${storyTimeColor}-fg}STORY ${storyTimeStr}{/${storyTimeColor}-fg}`);
    }
    
    // Segment time remaining (current input period)
    if (uiState.isInSeedingPhase() || uiState.isStoryActive()) {
      const segmentTime = uiState.getSegmentTimeRemaining();
      if (segmentTime > 0) {
        const segmentTimeStr = Utils.formatTime(segmentTime);
        const segmentTimeColor = segmentTime < 10000 ? 'yellow' : 'cyan';
        const phaseLabel = uiState.isInSeedingPhase() ? 'SEEDING' : 'SEGMENT';
        components.push(`{${segmentTimeColor}-fg}${phaseLabel} ${segmentTimeStr}{/${segmentTimeColor}-fg}`);
      }
    }
    
    // Player count
    const playerCount = uiState.getPlayerCount();
    components.push(`{magenta-fg}${playerCount} ${playerCount === 1 ? 'player' : 'players'}{/magenta-fg}`);
    
    // Competition mode indicator
    if (session.competitionMode) {
      components.push('{yellow-fg}🏆 COMPETITION{/yellow-fg}');
    }
    
    // Host indicator
    if (uiState.isHost()) {
      components.push('{green-fg}👑 HOST{/green-fg}');
    }

    // First line - status components
    const statusLine = components.join(' | ');
    
    // Second line - message or instructions
    let messageLine = '';
    if (message.text) {
      messageLine = `{${message.color}-fg}${message.text}{/${message.color}-fg}`;
    } else {
      // Default instructions based on phase
      if (uiState.isInSeedingPhase()) {
        messageLine = '{yellow-fg}📝 Seed your story! Everyone contributes to the opening...{/yellow-fg}';
      } else if (uiState.isStoryActive()) {
        messageLine = '{green-fg}✍️  Story in progress. Use Tab to switch input modes.{/green-fg}';
      } else if (uiState.isStoryComplete()) {
        messageLine = '{cyan-fg}🎉 Story complete! Export available.{/cyan-fg}';
      } else {
        messageLine = '{white-fg}Waiting to start...{/white-fg}';
      }
    }

    // Combine lines with centering
    const content = `{center}${statusLine}{/center}\n{center}${messageLine}{/center}`;
    
    this.box.setContent(content);
  }

  getPhaseColor(phase) {
    switch (phase) {
      case 'SEEDING': return 'yellow';
      case 'STORY': return 'green';
      case 'COMPLETE': return 'cyan';
      case 'WAITING': return 'white';
      default: return 'white';
    }
  }

  setMessage(message, color = 'white') {
    // This is handled through UIState now
  }

  focus() {
    this.box.focus();
  }

  hide() {
    this.box.hide();
  }

  show() {
    this.box.show();
  }
}

module.exports = StatusBar;
