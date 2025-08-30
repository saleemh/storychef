const blessed = require('blessed');
const Utils = require('../../shared/utils');

class TerminalUI {
  constructor(client) {
    this.client = client;
    this.screen = null;
    this.views = ['story', 'direct', 'influence', 'live', 'chat'];
    this.currentView = 0;
    this.competitionMode = false;
    
    // UI elements
    this.storyBox = null;
    this.inputBox = null;
    this.statusBar = null;
    this.goalsOverlay = null;
    
    // State
    this.inputMode = 'influence'; // 'influence' or 'direct'
    this.playerGoals = [];
    this.storyText = '';
    this.recentInputs = [];
    this.lastMessage = null;
    
    this.setupScreen();
    this.setupEventHandlers();
  }

  setupScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Story Chef',
      fullUnicode: true,
      dockBorders: true
    });

    this.setupViews();
    this.setupKeyBindings();
    this.render();
  }

  setupViews() {
    // Main story display box - top 70% of screen
    this.storyBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: '70%',
      border: { type: 'line' },
      scrollable: true,
      alwaysScroll: true,
      tags: true,
      label: ' Story View ',
      style: {
        border: { fg: 'cyan' },
        focus: { border: { fg: 'green' } }
      }
    });

    // Status bar - fixed 3 lines height
    this.statusBar = blessed.box({
      top: '70%',
      left: 0,
      width: '100%',
      height: 3,
      border: { type: 'line' },
      tags: true,
      label: ' Status ',
      style: {
        border: { fg: 'yellow' }
      }
    });

    // Input box - try textarea for better input handling
    this.inputBox = blessed.textarea({
      top: '70%+3',
      left: 0,
      width: '100%',
      height: 5,
      border: { type: 'line' },
      keys: true,
      mouse: true,
      label: ` [${this.inputMode.toUpperCase()} MODE] Type your ${this.inputMode} `,
      style: {
        border: { fg: 'magenta' },
        focus: { border: { fg: 'green' } }
      }
    });

    // Competition goals overlay (hidden by default)
    this.goalsOverlay = blessed.box({
      top: 'center',
      left: 'center',
      width: 80,
      height: 20,
      border: { type: 'line' },
      hidden: true,
      tags: true,
      label: ' YOUR SECRET GOALS ',
      style: {
        border: { fg: 'red' },
        bg: 'black'
      },
      scrollable: true
    });

    // Add elements to screen
    this.screen.append(this.storyBox);
    this.screen.append(this.statusBar);
    this.screen.append(this.inputBox);
    this.screen.append(this.goalsOverlay);

    // Focus input box initially and ensure it's empty
    this.inputBox.clearValue();
    this.inputBox.focus();
  }

  setupKeyBindings() {
    // Shift+Tab: Cycle views (Phase 2 feature, placeholder for now)
    this.screen.key(['S-tab'], () => {
      this.cycleView();
    });

    // G: Show goals (competition mode)
    this.screen.key(['g'], () => {
      if (this.competitionMode) {
        this.toggleGoalsView();
      }
    });

    // Down Arrow: Skip wait (will integrate with server later)
    this.screen.key(['down'], () => {
      this.requestSkip();
    });

    // C: Configuration panel (placeholder for Phase 3)
    this.screen.key(['c'], () => {
      this.showMessage('Configuration panel will be available in Phase 3');
    });

    // Tab: Switch input modes (Direct/Influence)
    this.screen.key(['tab'], () => {
      this.toggleInputMode();
    });

    // Removed problematic keypress listener that was causing duplicate characters

    // ESC/Ctrl+C: Exit
    this.screen.key(['escape', 'C-c'], () => {
      this.shutdown();
    });

    // Enter in input box: Submit input
    this.inputBox.key(['enter'], () => {
      this.submitCurrentInput();
    });

    // Help
    this.screen.key(['?'], () => {
      this.showHelp();
    });
  }

  setupEventHandlers() {
    // Client connection events
    this.client.on('connected', () => {
      this.showMessage('✅ Connected to Story Chef Server', 'green');
    });

    this.client.on('connection_error', (error) => {
      this.showMessage(`❌ Connection failed: ${error.message}`, 'red');
    });

    this.client.on('disconnected', (reason) => {
      this.showMessage(`🔴 Disconnected: ${reason}`, 'yellow');
    });

    // Session events
    this.client.on('session_created', (data) => {
      this.showMessage(`🎮 Session created: ${data.sessionId}`, 'green');
      this.updateSessionInfo(data.session);
    });

    this.client.on('session_joined', (data) => {
      this.showMessage(`🎮 Joined session: ${data.sessionId}`, 'green');
      this.updateSessionInfo(data.session);
    });

    this.client.on('session_updated', (session) => {
      this.updateSessionInfo(session);
    });

    this.client.on('player_joined', (data) => {
      this.showMessage(`👤 ${data.playerName} joined the story`, 'cyan');
    });

    this.client.on('player_left', (data) => {
      this.showMessage(`👤 ${data.playerName} left the story`, 'yellow');
    });

    // Story events
    this.client.on('story_started', () => {
      this.showMessage('📖 Story generation has begun!', 'green');
      this.updateLabel();
    });

    this.client.on('story_segment', (data) => {
      this.addStorySegment(data.segment);
    });

    this.client.on('story_complete', (data) => {
      this.showMessage(`🎉 Story complete! Duration: ${Utils.formatTime(data.duration * 1000)}`, 'green');
    });

    // Input events
    this.client.on('seed_added', (data) => {
      this.addRecentInput(`${data.playerName} [SEED]: ${data.content}`);
    });

    this.client.on('direct_input_added', (data) => {
      this.addRecentInput(`${data.playerName} [DIRECT]: ${data.content}`);
    });

    this.client.on('influence_input_added', (data) => {
      this.addRecentInput(`${data.playerName} [INFLUENCE]: ${data.content}`);
    });

    // Error handling
    this.client.on('error', (error) => {
      this.showMessage(`❌ Error: ${error.message}`, 'red');
    });
  }

  // View management
  cycleView() {
    // Placeholder for Phase 2 multi-view implementation
    this.showMessage('Multi-view interface will be available in Phase 2');
  }

  toggleInputMode() {
    this.inputMode = this.inputMode === 'influence' ? 'direct' : 'influence';
    this.updateLabel();
    this.showMessage(`Switched to ${this.inputMode.toUpperCase()} mode`, 'cyan');
    // Ensure input box has focus after mode switch
    this.inputBox.focus();
  }

  updateLabel() {
    const session = this.client.getSession();
    let modeText = this.inputMode.toUpperCase();
    
    if (session?.storyState.seedingPhase) {
      modeText = 'SEEDING';
    }
    
    this.inputBox.setLabel(` [${modeText} MODE] Type your ${session?.storyState.seedingPhase ? 'story seed' : this.inputMode} `);
    this.inputBox.focus();
    this.render();
  }

  // Goals management (competition mode)
  toggleGoalsView() {
    if (this.goalsOverlay.hidden) {
      this.showGoals();
    } else {
      this.hideGoals();
    }
  }

  showGoals() {
    if (this.playerGoals.length === 0) {
      this.goalsOverlay.setContent('\n  {center}No goals assigned yet{/center}');
    } else {
      let content = '\n  Your secret goals:\n\n';
      this.playerGoals.forEach((goal, index) => {
        const status = goal.achieved ? '✅' : '❓';
        content += `  ${status} Goal ${index + 1}: ${goal.text}\n`;
      });
      content += '\n  Press any key to return to story...';
      this.goalsOverlay.setContent(content);
    }
    
    this.goalsOverlay.show();
    this.goalsOverlay.focus();
    this.render();

    // Hide on any key press
    const hideHandler = () => {
      this.hideGoals();
      this.goalsOverlay.removeListener('keypress', hideHandler);
    };
    this.goalsOverlay.on('keypress', hideHandler);
  }

  hideGoals() {
    this.goalsOverlay.hide();
    this.inputBox.focus();
    this.render();
  }

  // Story content management
  addStorySegment(segment) {
    this.storyText += `\n\n${segment.text}`;
    this.updateStoryDisplay();
    this.showMessage(`📖 New story segment generated`, 'green');
  }

  updateStoryDisplay() {
    const session = this.client.getSession();
    let content = '';

    // Add title if available
    if (session?.sessionId) {
      content += `{center}{bold}${session.sessionId}{/bold}{/center}\n\n`;
    }

    // Add story content
    if (this.storyText) {
      content += this.storyText;
    } else if (session?.storyState.seedingPhase) {
      content += '{center}📝 STORY SEEDING PHASE 📝{/center}\n\n';
      content += 'Waiting for players to seed the story...\n';
    } else {
      content += '{center}🌟 Welcome to Story Chef! 🌟{/center}\n\n';
      content += 'Create or join a session to begin your collaborative story adventure.\n';
    }

    // Add recent inputs section
    if (this.recentInputs.length > 0) {
      content += '\n\n{bold}Recent Player Inputs:{/bold}\n';
      this.recentInputs.slice(-5).forEach(input => {
        content += `${input}\n`;
      });
    }

    this.storyBox.setContent(content);
    this.storyBox.scrollTo(this.storyBox.getScrollHeight());
    this.render();
  }

  addRecentInput(inputText) {
    this.recentInputs.push(inputText);
    if (this.recentInputs.length > 10) {
      this.recentInputs = this.recentInputs.slice(-10);
    }
    this.updateStoryDisplay();
  }

  // Status bar updates
  updateStatus() {
    const session = this.client.getSession();
    let statusText = '';

    if (session) {
      const playerCount = session.players.filter(p => p.isConnected).length;
      const timeRemaining = session.storyState.timeRemaining;
      
      statusText += `[⏰ ${Utils.formatTime(timeRemaining)}] `;
      statusText += `| 👥 ${playerCount} `;
      
      if (session.storyState.seedingPhase) {
        statusText += '| 📝 Seeding Phase';
      } else if (session.storyState.isActive) {
        statusText += '| 📖 Story Active';
      } else if (session.storyState.isCompleted) {
        statusText += '| ✅ Story Complete';
      }

      if (session.competitionMode) {
        statusText += ' | 🏆 Competition Mode';
      }
    } else {
      statusText = 'Not connected to a session';
    }

    // Add last message to status if available
    if (this.lastMessage) {
      statusText += `\n{dim}[${this.lastMessage.timestamp}]{/dim} ${this.lastMessage.text}`;
    }

    this.statusBar.setContent(`  ${statusText}`);
  }

  updateSessionInfo(session) {
    this.competitionMode = session.competitionMode || false;
    this.updateStatus();
    this.updateStoryDisplay();
    this.updateLabel();
  }

  // Input handling
  async submitCurrentInput() {
    const content = this.inputBox.getValue().trim();
    if (!content) return;

    this.inputBox.clearValue();

    try {
      const session = this.client.getSession();
      
      if (session?.storyState.seedingPhase) {
        await this.client.submitStorySeed(content);
        this.showMessage('Story seed submitted', 'green');
      } else if (this.inputMode === 'direct') {
        await this.client.submitDirectInput(content);
        this.showMessage('Direct input submitted', 'green');
      } else {
        await this.client.submitInfluenceInput(content);
        this.showMessage('Influence input submitted', 'green');
      }
    } catch (error) {
      this.showMessage(`Failed to submit input: ${error.message}`, 'red');
    }
  }

  requestSkip() {
    // Placeholder for skip functionality
    this.showMessage('Skip functionality will be implemented with story engine', 'yellow');
  }

  // UI utilities
  showMessage(message, color = 'white') {
    const timestamp = new Date().toLocaleTimeString();
    const coloredMessage = color === 'white' ? message : `{${color}-fg}${message}{/}`;
    
    // Store the last message to show with status
    this.lastMessage = {
      text: coloredMessage,
      timestamp: timestamp
    };
    
    this.updateStatus();
    this.render();
  }

  showHelp() {
    const helpText = `
{center}{bold}STORY CHEF - HELP{/bold}{/center}

{bold}Controls:{/bold}
  Tab          Switch between Direct/Influence input modes
  Enter        Submit current input
  G            View secret goals (competition mode)
  ↓            Request to skip wait time
  C            Configuration panel (Phase 3)
  Shift+Tab    Cycle views (Phase 2) 
  ?            Show this help
  Esc/Ctrl+C   Exit

{bold}Input Modes:{/bold}
  DIRECT       Write exact text to include in story
  INFLUENCE    Suggest story direction and themes
  SEEDING      Create initial story foundation (30 seconds)

{bold}Game Flow:{/bold}
  1. Create or join session with game code
  2. Seed the story (all players, 30 seconds)
  3. Collaborate through Direct/Influence inputs
  4. AI generates story segments every 30 seconds
  5. Story concludes after 10 minutes

Press any key to return...
`;

    const helpBox = blessed.box({
      top: 'center',
      left: 'center',
      width: 60,
      height: 25,
      border: { type: 'line' },
      tags: true,
      content: helpText,
      style: {
        border: { fg: 'blue' },
        bg: 'black'
      }
    });

    this.screen.append(helpBox);
    helpBox.focus();
    this.render();

    const hideHelp = () => {
      this.screen.remove(helpBox);
      this.inputBox.focus();
      this.render();
      helpBox.removeListener('keypress', hideHelp);
    };
    
    helpBox.on('keypress', hideHelp);
  }

  render() {
    this.updateStatus();
    this.screen.render();
  }

  shutdown() {
    this.client.disconnect();
    this.screen.destroy();
    process.exit(0);
  }

  // Public methods for external control
  displayWelcome() {
    this.showMessage('🌟 Welcome to Story Chef! 🌟', 'cyan');
    this.showMessage('Create a new session or join existing one with a game code.', 'white');
    this.updateStoryDisplay();
  }

  setPlayerGoals(goals) {
    this.playerGoals = goals;
    this.showMessage(`🎯 ${goals.length} secret goals assigned`, 'magenta');
  }

  focusInput() {
    this.inputBox.focus();
    this.render();
  }
}

module.exports = TerminalUI;