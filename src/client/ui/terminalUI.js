const blessed = require('blessed');
const EventEmitter = require('events');
const UIState = require('./uiState');
const StatusBar = require('./components/StatusBar');
const StoryView = require('./components/StoryView');
const InputBar = require('./components/InputBar');
const Modal = require('./components/Modal');

/**
 * TerminalUI - Main terminal interface orchestrator
 * 
 * Implements the complete terminal UI for StoryChef following planning.md design:
 * - Multi-view interface (Story/Direct/Influence/Live/Chat)
 * - Dual input modes (Direct/Influence)
 * - Competition mode with goals
 * - Real-time multiplayer support
 */
class TerminalUI extends EventEmitter {
  constructor(client, inputProcessor) {
    super();
    
    this.client = client;
    this.inputProcessor = inputProcessor;
    
    // UI components and state
    this.screen = null;
    this.uiState = new UIState();
    
    // Views tracking
    this.views = ['story', 'direct', 'influence', 'live', 'chat'];
    this.currentViewIndex = 0;
    
    // Component references
    this.statusBar = null;
    this.storyView = null;
    this.inputBar = null;
    this.directView = null;
    this.influenceView = null;
    this.liveView = null;
    this.chatView = null;
    
    // Modals
    this.goalsModal = null;
    this.helpModal = null;
    this.configModal = null;
    
    // Initialize UI
    this.setupScreen();
    this.setupComponents();
    this.setupKeyBindings();
    this.setupEventHandlers();
    
    // Start UI state ticker for countdown
    this.uiState.startTicker();
  }

  /**
   * Create and configure the blessed screen
   */
  setupScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Story Chef',
      fullUnicode: false,
      dockBorders: true,
      terminal: process.env.TERM || 'xterm-256color',
      useBCE: true,
      sendFocus: true,
      warnings: true
    });

    // Ensure proper input handling
    this.screen.enableInput();
    
    // Set up clean exit handling
    this.screen.on('destroy', () => {
      this.cleanup();
    });
  }

  /**
   * Create all UI components
   */
  setupComponents() {
    // Status bar at top
    this.statusBar = new StatusBar();
    
    // Main content views (only one visible at a time)
    this.storyView = new StoryView();
    this.directView = this.createDirectView();
    this.influenceView = this.createInfluenceView();
    this.liveView = this.createLiveView();
    this.chatView = this.createChatView();
    
    // Input bar at bottom
    this.inputBar = new InputBar(
      (uiState) => this.getInputLabels(uiState),
      async (text) => await this.handleInputSubmit(text)
    );
    
    // Modals
    this.goalsModal = new Modal(' YOUR SECRET GOALS ', 80, 25);
    this.helpModal = new Modal(' HELP ', 70, 30);
    this.configModal = new Modal(' CONFIGURATION ', 80, 25);
    
    // Add components to screen
    this.screen.append(this.statusBar.getElement());
    this.screen.append(this.storyView.getElement());
    this.screen.append(this.directView);
    this.screen.append(this.influenceView);
    this.screen.append(this.liveView);
    this.screen.append(this.chatView);
    this.screen.append(this.inputBar.getElement());
    this.screen.append(this.goalsModal.getElement());
    this.screen.append(this.helpModal.getElement());
    this.screen.append(this.configModal.getElement());
    
    // Show only the current view
    this.showCurrentView();
    
    // Focus on input
    this.inputBar.focus();
    
    // Listen to UI state changes
    this.uiState.on('change', () => this.render());
    this.uiState.on('tick', () => this.render());
  }

  /**
   * Create the Direct input view (Phase 2 feature)
   */
  createDirectView() {
    const view = blessed.box({
      top: 3,
      left: 0,
      width: '100%',
      height: '70%',
      border: { type: 'line' },
      label: ' ✍️ DIRECT STORY INPUT ',
      hidden: true,
      scrollable: true,
      mouse: true,
      keys: true,
      vi: true,
      tags: true,
      padding: { left: 1, right: 1 }
    });
    
    return view;
  }

  /**
   * Create the Influence input view (Phase 2 feature)
   */
  createInfluenceView() {
    const view = blessed.box({
      top: 3,
      left: 0,
      width: '100%',
      height: '70%',
      border: { type: 'line' },
      label: ' 💭 INFLUENCE INPUT ',
      hidden: true,
      scrollable: true,
      mouse: true,
      keys: true,
      vi: true,
      tags: true,
      padding: { left: 1, right: 1 }
    });
    
    return view;
  }

  /**
   * Create the Live input view for multiplayer (Phase 2 feature)
   */
  createLiveView() {
    const view = blessed.box({
      top: 3,
      left: 0,
      width: '100%',
      height: '70%',
      border: { type: 'line' },
      label: ' 📝 LIVE INPUT VIEW ',
      hidden: true,
      scrollable: true,
      mouse: true,
      keys: true,
      vi: true,
      tags: true,
      padding: { left: 1, right: 1 }
    });
    
    return view;
  }

  /**
   * Create the Chat view for multiplayer (Phase 2 feature)
   */
  createChatView() {
    const view = blessed.box({
      top: 3,
      left: 0,
      width: '100%',
      height: '70%',
      border: { type: 'line' },
      label: ' 💬 CHAT VIEW ',
      hidden: true,
      scrollable: true,
      mouse: true,
      keys: true,
      vi: true,
      tags: true,
      padding: { left: 1, right: 1 }
    });
    
    return view;
  }

  /**
   * Set up all keyboard shortcuts
   */
  setupKeyBindings() {
    // Tab: Switch input modes (Direct/Influence)
    this.screen.key(['tab'], () => {
      this.toggleInputMode();
    });
    
    // Also capture tab on input bar
    this.inputBar.getElement().key(['tab'], () => {
      this.toggleInputMode();
    });
    
    // Shift+Tab: Cycle views (Phase 2 - show message for now)
    this.screen.key(['S-tab'], () => {
      this.cycleView();
    });
    
    // G: Show goals (competition mode)
    this.screen.key(['g', 'G'], () => {
      if (this.uiState.getSession()?.competitionMode) {
        this.showGoals();
      }
    });
    
    // Down arrow: Skip wait
    this.screen.key(['down'], () => {
      this.requestSkip();
    });
    
    // C: Configuration panel (Phase 3 - show message for now)
    this.screen.key(['c', 'C'], () => {
      this.showConfig();
    });
    
    // ?: Show help
    this.screen.key(['?'], () => {
      this.showHelp();
    });
    
    // ESC/Ctrl+C: Exit
    this.screen.key(['escape', 'C-c'], () => {
      this.shutdown();
    });
  }

  /**
   * Set up event handlers for client events
   */
  setupEventHandlers() {
    // Connection events
    this.client.on('connected', () => {
      this.uiState.setMessage('✅ Connected to Story Chef Server', 'green');
    });
    
    this.client.on('connection_error', (error) => {
      this.uiState.setMessage(`❌ Connection failed: ${error.message}`, 'red');
    });
    
    this.client.on('disconnected', (reason) => {
      this.uiState.setMessage(`🔴 Disconnected: ${reason}`, 'yellow');
    });
    
    // Session events
    this.client.on('session_created', (data) => {
      this.uiState.setSession(data.session);
      this.uiState.setPlayerInfo(data.playerId, this.client.getPlayerName());
      this.uiState.setMessage(`🎮 Session created: ${data.sessionId}`, 'green');
    });
    
    this.client.on('session_joined', (data) => {
      this.uiState.setSession(data.session);
      this.uiState.setPlayerInfo(data.playerId, this.client.getPlayerName());
      this.uiState.setMessage(`🎮 Joined session: ${data.sessionId}`, 'green');
    });
    
    this.client.on('session_updated', (session) => {
      this.uiState.setSession(session);
    });
    
    // Player events
    this.client.on('player_joined', (data) => {
      this.uiState.setMessage(`👤 ${data.playerName} joined the story`, 'cyan');
    });
    
    this.client.on('player_left', (data) => {
      this.uiState.setMessage(`👤 ${data.playerName} left the story`, 'yellow');
    });
    
    // Story events
    this.client.on('story_started', () => {
      this.uiState.setMessage('📖 Story generation has begun!', 'green');
    });
    
    this.client.on('story_segment', (data) => {
      this.uiState.addStorySegment(data.segment);
      // No message for segments - they show in the story view
    });
    
    this.client.on('story_complete', (data) => {
      this.uiState.setMessage(`🎉 Story complete! Duration: ${data.duration}`, 'green');
    });
    
    // Input events - both from server (other players) and local confirmations
    this.client.on('seed_added', (data) => {
      if (data.playerName) {
        this.uiState.addRecentInput(`${data.playerName} [SEED]: ${data.content}`);
      }
    });
    
    this.client.on('direct_input_added', (data) => {
      if (data.playerName) {
        this.uiState.addRecentInput(`${data.playerName} [DIRECT]: ${data.content}`);
      }
    });
    
    this.client.on('influence_input_added', (data) => {
      if (data.playerName) {
        this.uiState.addRecentInput(`${data.playerName} [INFLUENCE]: ${data.content}`);
      }
    });
    
    // Local input confirmations
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
    
    // Competition events
    this.client.on('goals_assigned', (goals) => {
      this.uiState.setGoals(goals);
      this.uiState.setMessage(`🎯 ${goals.length} secret goals assigned`, 'magenta');
    });
    
    // Error events
    this.client.on('error', (error) => {
      this.uiState.setMessage(`❌ Error: ${error.message}`, 'red');
    });
  }

  /**
   * Get input labels based on current state
   */
  getInputLabels(uiState) {
    const mode = this.inputProcessor.getInputModeDisplay();
    const label = this.inputProcessor.getInputLabel();
    
    return {
      modeText: mode,
      label: label
    };
  }

  /**
   * Handle input submission
   */
  async handleInputSubmit(text) {
    try {
      const result = await this.inputProcessor.processInput(text);
      
      if (!result.success && result.error) {
        this.uiState.setMessage(result.error, 'red');
      }
      
      // Clear and refocus input
      this.inputBar.clear();
      this.inputBar.focus();
      
      return result;
    } catch (error) {
      this.uiState.setMessage(`Failed to submit: ${error.message}`, 'red');
      return { success: false, error: error.message };
    }
  }

  /**
   * Toggle between Direct and Influence input modes
   */
  toggleInputMode() {
    const result = this.inputProcessor.toggleInputMode();
    this.uiState.setInputMode(result.currentMode);
    this.uiState.setMessage(`Switched to ${result.currentMode.toUpperCase()} mode`, 'cyan');
    
    // Ensure input stays focused
    this.inputBar.focus();
  }

  /**
   * Cycle through available views (Phase 2 feature)
   */
  cycleView() {
    // For Phase 1, just show a message
    this.uiState.setMessage('Multi-view interface will be available in Phase 2', 'yellow');
    
    // Phase 2 implementation would be:
    /*
    this.currentViewIndex = (this.currentViewIndex + 1) % this.views.length;
    this.showCurrentView();
    this.uiState.setMessage(`Switched to ${this.views[this.currentViewIndex]} view`, 'cyan');
    */
  }

  /**
   * Show the current view and hide others
   */
  showCurrentView() {
    // Hide all views
    this.storyView.hide();
    this.directView.hide();
    this.influenceView.hide();
    this.liveView.hide();
    this.chatView.hide();
    
    // Show current view
    switch (this.views[this.currentViewIndex]) {
      case 'story':
        this.storyView.show();
        break;
      case 'direct':
        this.directView.show();
        this.updateDirectView();
        break;
      case 'influence':
        this.influenceView.show();
        this.updateInfluenceView();
        break;
      case 'live':
        this.liveView.show();
        this.updateLiveView();
        break;
      case 'chat':
        this.chatView.show();
        this.updateChatView();
        break;
    }
    
    this.render();
  }

  /**
   * Update the Direct view content (Phase 2)
   */
  updateDirectView() {
    const story = this.uiState.getFullStory();
    const lastParagraph = story.split('\n\n').filter(p => p.trim()).pop() || '';
    
    const content = `
{yellow-fg}Recent story context:{/yellow-fg}
...${lastParagraph}

{green-fg}[🎯 Next segment generates in ${Math.floor(this.uiState.getTimeRemaining() / 1000)} seconds...]{/green-fg}

{white-fg}Write exact text to include in the story:{/white-fg}
`;
    
    this.directView.setContent(content);
  }

  /**
   * Update the Influence view content (Phase 2)
   */
  updateInfluenceView() {
    const story = this.uiState.getFullStory();
    const lastParagraph = story.split('\n\n').filter(p => p.trim()).pop() || '';
    
    const content = `
{yellow-fg}Recent story context:{/yellow-fg}
...${lastParagraph}

{green-fg}[🎯 Next segment generates in ${Math.floor(this.uiState.getTimeRemaining() / 1000)} seconds...]{/green-fg}

{white-fg}Guide the story direction:{/white-fg}
`;
    
    this.influenceView.setContent(content);
  }

  /**
   * Update the Live view content (Phase 2)
   */
  updateLiveView() {
    const recentInputs = this.uiState.getRecentInputs();
    const content = recentInputs.length > 0 
      ? recentInputs.join('\n')
      : '{white-fg}Waiting for player inputs...{/white-fg}';
    
    this.liveView.setContent(content);
  }

  /**
   * Update the Chat view content (Phase 2)
   */
  updateChatView() {
    const content = '{yellow-fg}Chat feature will be available in Phase 2{/yellow-fg}';
    this.chatView.setContent(content);
  }

  /**
   * Show goals modal (competition mode)
   */
  showGoals() {
    const goals = this.uiState.getGoals();
    let content = '\n{yellow-fg}Your secret goals:{/yellow-fg}\n\n';
    
    if (goals.length === 0) {
      content += '{center}No goals assigned yet{/center}\n';
    } else {
      goals.forEach((goal, index) => {
        const status = goal.achieved ? '{green-fg}✅{/green-fg}' : '{white-fg}❓{/white-fg}';
        const text = goal.text || String(goal);
        content += `  ${status} Goal ${index + 1}: ${text}\n`;
      });
    }
    
    content += '\n{center}{white-fg}Press any key to return to story...{/white-fg}{/center}';
    
    this.goalsModal.show(content);
    this.goalsModal.setOnHide(() => {
      this.inputBar.focus();
    });
  }

  /**
   * Request to skip the wait time
   */
  requestSkip() {
    // Phase 1: Just show message
    this.uiState.setMessage('Skip functionality will be implemented with story engine', 'yellow');
    
    // Phase 2 would emit: this.client.emit('skip_request');
  }

  /**
   * Show configuration panel (Phase 3 feature)
   */
  showConfig() {
    // Phase 1: Just show message
    this.uiState.setMessage('Configuration panel will be available in Phase 3', 'yellow');
    
    // Phase 3 would show actual config UI
  }

  /**
   * Show help modal
   */
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
  {yellow-fg}SEEDING{/yellow-fg}     Create initial story foundation (30 seconds)
  {green-fg}DIRECT{/green-fg}      Write exact text to include in story
  {magenta-fg}INFLUENCE{/magenta-fg}   Suggest story direction and themes

{bold}Game Flow:{/bold}
  1. Create or join session with game code
  2. Seed the story (all players, 30 seconds)
  3. Collaborate through Direct/Influence inputs
  4. AI generates story segments every 30 seconds
  5. Story concludes after 10 minutes

{bold}Competition Mode:{/bold}
  - Each player receives secret goals
  - Try to guide the story to achieve your goals
  - Goals are scored at the end (1-3 points each)
  - Winner has the highest total score

{center}{white-fg}Press any key to return...{/white-fg}{/center}
`;
    
    this.helpModal.show(helpText);
    this.helpModal.setOnHide(() => {
      this.inputBar.focus();
    });
  }

  /**
   * Main render method
   */
  render() {
    // Update all visible components
    this.statusBar.render(this.uiState);
    this.storyView.render(this.uiState);
    this.inputBar.render(this.uiState);
    
    // Update view-specific content if needed
    if (this.views[this.currentViewIndex] !== 'story') {
      this.showCurrentView();
    }
    
    // Render screen
    this.screen.render();
  }

  /**
   * Clean shutdown
   */
  shutdown() {
    this.cleanup();
    this.client.disconnect();
    process.exit(0);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.uiState.destroy();
    if (this.screen) {
      this.screen.destroy();
    }
  }

  // Public API methods

  /**
   * Display welcome message
   */
  displayWelcome() {
    this.uiState.setMessage('🌟 Welcome to Story Chef! 🌟', 'cyan');
    this.render();
  }

  /**
   * Show a message to the user
   */
  showMessage(message, color = 'white') {
    this.uiState.setMessage(message, color);
    this.render();
  }

  /**
   * Set player goals (competition mode)
   */
  setPlayerGoals(goals) {
    this.uiState.setGoals(goals);
    this.showMessage(`🎯 ${goals.length} secret goals assigned`, 'magenta');
  }

  /**
   * Focus the input bar
   */
  focusInput() {
    this.inputBar.focus();
    this.render();
  }
}

module.exports = TerminalUI;