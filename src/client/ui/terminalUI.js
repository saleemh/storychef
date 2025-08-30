const blessed = require('blessed');
const Utils = require('../../shared/utils');
const UIState = require('./uiState');
const StatusBar = require('./components/StatusBar');
const StoryView = require('./components/StoryView');
const InputBar = require('./components/InputBar');
const Modal = require('./components/Modal');

class TerminalUI {
  constructor(client, inputProcessor) {
    this.client = client;
    this.inputProcessor = inputProcessor;
    this.screen = null;
    this.views = ['story', 'direct', 'influence', 'live', 'chat'];
    this.currentView = 0;
    this.uiState = new UIState();

    // Components
    this.storyView = null;
    this.statusBar = null;
    this.inputBar = null;
    this.goalsModal = null;
    this.helpModal = null;

    this.setupScreen();
    this.setupEventHandlers();
  }

  setupScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Story Chef',
      // Disable fullUnicode to avoid width mis-detection/duplication on some terminals
      fullUnicode: false,
      dockBorders: true,
      terminal: process.env.TERM || 'xterm-256color',
      useBCE: true,
      sendFocus: true
    });

    // Ensure raw mode for clean input (prevents terminal echo/duplication)
    try {
      if (this.screen.program && typeof this.screen.program.setRawMode === 'function') {
        this.screen.program.setRawMode(true);
      }
      const inp = this.screen.program.input || process.stdin;
      if (inp && typeof inp.setRawMode === 'function') inp.setRawMode(true);
      if (inp && typeof inp.resume === 'function') inp.resume();
    } catch (_) {
      // best-effort; blessed should handle raw mode
    }

    this.setupViews();
    this.setupKeyBindings();
    this.render();
  }

  setupViews() {
    // Components
    this.storyView = new StoryView();
    this.statusBar = new StatusBar();
    this.inputBar = new InputBar(
      () => ({
        modeText: this.inputProcessor.getInputModeDisplay(),
        label: this.inputProcessor.getInputLabel()
      }),
      async (text) => {
        const result = await this.inputProcessor.processInput(text);
        if (result.success) {
          const type = result.inputType.toUpperCase();
          this.showMessage(`${type} input submitted`, 'green');
        } else {
          this.showMessage(`Failed to submit: ${result.error}`, 'red');
        }
        this.render();
      }
    );
    this.goalsModal = new Modal(' YOUR SECRET GOALS ', 80, 20);
    this.helpModal = new Modal(' HELP ', 60, 25);

    // Append to screen
    this.screen.append(this.storyView.getElement());
    this.screen.append(this.statusBar.getElement());
    this.screen.append(this.inputBar.getElement());
    this.screen.append(this.goalsModal.getElement());
    this.screen.append(this.helpModal.getElement());

    // Focus input
    this.inputBar.clear?.();
    this.inputBar.focus();

    // UI State listeners
    this.uiState.on('change', () => this.render());
    this.uiState.on('tick', () => this.render());
    this.uiState.startTicker();
  }

  setupKeyBindings() {
    // Shift+Tab: Cycle views (Phase 2 placeholder)
    this.screen.key(['S-tab'], () => this.cycleView());

    // G: Show goals (competition mode)
    this.screen.key(['g'], () => {
      if (this.uiState.session?.competitionMode) {
        this.showGoals();
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
    this.screen.key(['tab'], () => this.toggleInputMode());
    // Also capture Tab while textbox focused
    this.inputBar.getElement().key(['tab'], () => this.toggleInputMode());

    // Removed problematic keypress listener that was causing duplicate characters

    // ESC/Ctrl+C: Exit
    this.screen.key(['escape', 'C-c'], () => this.shutdown());

    // Help
    this.screen.key(['?'], () => this.showHelp());
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
      this.updateLabels();
    });

    this.client.on('story_segment', (data) => {
      this.uiState.addStorySegment(data.segment);
    });

    this.client.on('story_complete', (data) => {
      this.showMessage(`🎉 Story complete! Duration: ${Utils.formatTime(data.duration * 1000)}`, 'green');
    });

    // Input events
    this.client.on('seed_added', (data) => {
      this.uiState.addRecentInput(`${data.playerName || 'Player'} [SEED]: ${data.content}`);
    });

    this.client.on('direct_input_added', (data) => {
      this.uiState.addRecentInput(`${data.playerName || 'Player'} [DIRECT]: ${data.content}`);
    });

    this.client.on('influence_input_added', (data) => {
      this.uiState.addRecentInput(`${data.playerName || 'Player'} [INFLUENCE]: ${data.content}`);
    });

    // Error handling
    this.client.on('error', (error) => {
      this.showMessage(`❌ Error: ${error.message}`, 'red');
    });

    // Local submit confirmations (reflect own inputs immediately)
    this.client.on('seed_submitted', ({ content }) => {
      const name = this.client.getPlayerName() || 'You';
      this.uiState.addRecentInput(`${name} [SEED]: ${content}`);
    });
    this.client.on('direct_input_submitted', ({ content }) => {
      const name = this.client.getPlayerName() || 'You';
      this.uiState.addRecentInput(`${name} [DIRECT]: ${content}`);
    });
    this.client.on('influence_input_submitted', ({ content }) => {
      const name = this.client.getPlayerName() || 'You';
      this.uiState.addRecentInput(`${name} [INFLUENCE]: ${content}`);
    });
  }

  // View management
  cycleView() {
    // Placeholder for Phase 2 multi-view implementation
    this.showMessage('Multi-view interface will be available in Phase 2');
  }

  toggleInputMode() {
    const toggle = this.inputProcessor.toggleInputMode();
    this.uiState.setInputMode(toggle.currentMode);
    this.updateLabels();
    this.showMessage(`Switched to ${toggle.currentMode.toUpperCase()} mode`, 'cyan');
    this.inputBar.focus();
  }

  updateLabels() {
    // Trigger InputBar to re-render with updated labels
    this.render();
  }

  // Goals management (competition mode)
  showGoals() {
    let content = '\n  Your secret goals:\n\n';
    const goals = this.uiState.playerGoals || [];
    if (goals.length === 0) {
      content += '  {center}No goals assigned yet{/center}\n';
    } else {
      goals.forEach((goal, index) => {
        const status = goal.achieved ? '✅' : '❓';
        const text = goal.text || String(goal);
        content += `  ${status} Goal ${index + 1}: ${text}\n`;
      });
    }
    content += '\n  Press any key to return to story...';
    this.goalsModal.show(content);

    const hideHandler = () => {
      this.goalsModal.hide();
      this.inputBar.focus();
      this.screen.render();
      this.goalsModal.getElement().removeListener('keypress', hideHandler);
    };
    this.goalsModal.getElement().on('keypress', hideHandler);
  }

  hideGoals() {
    this.goalsModal.hide();
    this.inputBar.focus();
    this.render();
  }

  // Story content management
  addStorySegment(segment) {
    this.storyText += `\n\n${segment.text}`;
    this.updateStoryDisplay();
    this.showMessage(`📖 New story segment generated`, 'green');
  }

  addRecentInput(inputText) {
    this.uiState.addRecentInput(inputText);
  }

  // Status bar updates
  updateStatus() {
    this.statusBar.render(this.uiState);
  }

  updateSessionInfo(session) {
    this.uiState.setSession(session);
    this.updateStatus();
    this.render();
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
    this.uiState.setMessage(message, color);
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

    this.helpModal.show(helpText);
    const hideHelp = () => {
      this.helpModal.hide();
      this.inputBar.focus();
      this.render();
      this.helpModal.getElement().removeListener('keypress', hideHelp);
    };
    this.helpModal.getElement().on('keypress', hideHelp);
  }

  render() {
    this.statusBar.render(this.uiState);
    this.storyView.render(this.uiState);
    this.inputBar.render(this.uiState);
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
    this.render();
  }

  setPlayerGoals(goals) {
    this.uiState.setGoals(goals);
    this.showMessage(`🎯 ${goals.length} secret goals assigned`, 'magenta');
  }

  focusInput() {
    this.inputBar.focus();
    this.render();
  }
}

module.exports = TerminalUI;
