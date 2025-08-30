const EventEmitter = require('events');

/**
 * UIState - Centralized state management for the terminal UI
 * 
 * Manages all UI state including:
 * - Session information
 * - Story content and segments
 * - Recent player inputs
 * - Player goals (competition mode)
 * - Status messages
 * - Countdown timer
 */
class UIState extends EventEmitter {
  constructor() {
    super();
    
    // Session state
    this.session = null;
    this.playerId = null;
    this.playerName = null;
    
    // Story state
    this.storySegments = [];
    this.recentInputs = [];
    this.maxRecentInputs = 10;
    
    // Competition state
    this.playerGoals = [];
    
    // UI state
    this.currentInputMode = 'influence';
    this.statusMessage = '';
    this.statusMessageColor = 'white';
    
    // Timer state
    this.timeRemaining = 0;
    this.segmentTimeRemaining = 0;
    this.timerInterval = null;
  }

  // Session management
  setSession(session) {
    this.session = session;
    
    // Update time remaining from session
    if (session?.storyState?.timeRemaining) {
      this.timeRemaining = session.storyState.timeRemaining;
    }
    
    // Update segment time remaining from session
    if (session?.storyState?.segmentTimeRemaining !== undefined) {
      this.segmentTimeRemaining = session.storyState.segmentTimeRemaining;
    }
    
    this.emit('change', { type: 'session', session });
  }

  getSession() {
    return this.session;
  }

  setPlayerInfo(playerId, playerName) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.emit('change', { type: 'player', playerId, playerName });
  }

  // Story content management
  addStorySegment(segment) {
    this.storySegments.push(segment);
    this.emit('change', { type: 'story_segment', segment });
  }

  getFullStory() {
    return this.storySegments
      .map(seg => seg.text || seg)
      .join('\n\n');
  }

  clearStory() {
    this.storySegments = [];
    this.emit('change', { type: 'story_clear' });
  }

  // Input tracking
  addRecentInput(inputText) {
    this.recentInputs.unshift(inputText);
    
    // Keep only the most recent inputs
    if (this.recentInputs.length > this.maxRecentInputs) {
      this.recentInputs = this.recentInputs.slice(0, this.maxRecentInputs);
    }
    
    this.emit('change', { type: 'input_added', input: inputText });
  }

  getRecentInputs() {
    return this.recentInputs;
  }

  // Competition goals
  setGoals(goals) {
    this.playerGoals = goals || [];
    this.emit('change', { type: 'goals', goals: this.playerGoals });
  }

  getGoals() {
    return this.playerGoals;
  }

  markGoalAchieved(goalIndex) {
    if (this.playerGoals[goalIndex]) {
      this.playerGoals[goalIndex].achieved = true;
      this.emit('change', { type: 'goal_achieved', goalIndex });
    }
  }

  // Input mode
  setInputMode(mode) {
    if (mode !== 'direct' && mode !== 'influence') {
      throw new Error(`Invalid input mode: ${mode}`);
    }
    
    this.currentInputMode = mode;
    this.emit('change', { type: 'input_mode', mode });
  }

  getInputMode() {
    return this.currentInputMode;
  }

  // Status messages
  setMessage(message, color = 'white') {
    this.statusMessage = message;
    this.statusMessageColor = color;
    this.emit('change', { type: 'message', message, color });
    
    // Clear message after 5 seconds
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
    
    this.messageTimeout = setTimeout(() => {
      this.statusMessage = '';
      this.emit('change', { type: 'message_clear' });
    }, 5000);
  }

  getMessage() {
    return {
      text: this.statusMessage,
      color: this.statusMessageColor
    };
  }

  // Timer management
  startTicker() {
    // Clear any existing ticker
    this.stopTicker();
    
    // Update timer every second for smooth countdown display
    // But rely on server for authoritative time updates
    this.timerInterval = setInterval(() => {
      if (this.timeRemaining > 0) {
        // Only decrease by 1 second for smooth UI, server will correct it
        this.timeRemaining = Math.max(0, this.timeRemaining - 1000);
      }
      
      if (this.segmentTimeRemaining > 0) {
        // Also countdown segment timer
        this.segmentTimeRemaining = Math.max(0, this.segmentTimeRemaining - 1000);
      }
      
      this.emit('tick', { 
        timeRemaining: this.timeRemaining,
        segmentTimeRemaining: this.segmentTimeRemaining
      });
    }, 1000);
  }

  stopTicker() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimeRemaining(milliseconds) {
    this.timeRemaining = milliseconds;
    this.emit('change', { type: 'timer', timeRemaining: milliseconds });
  }

  getTimeRemaining() {
    return this.timeRemaining;
  }

  getSegmentTimeRemaining() {
    return this.segmentTimeRemaining;
  }

  // Game phase helpers
  isInSeedingPhase() {
    return this.session?.storyState?.seedingPhase || false;
  }

  isStoryActive() {
    return this.session?.storyState?.isActive || false;
  }

  isStoryComplete() {
    return this.session?.storyState?.isCompleted || false;
  }

  getPhaseText() {
    if (this.isStoryComplete()) return 'COMPLETE';
    if (this.isInSeedingPhase()) return 'SEEDING';
    if (this.isStoryActive()) return 'STORY';
    return 'WAITING';
  }

  // Player information
  getConnectedPlayers() {
    if (!this.session?.players) return [];
    return this.session.players.filter(p => p.isConnected);
  }

  getPlayerCount() {
    return this.getConnectedPlayers().length;
  }

  isHost() {
    if (!this.session?.players || !this.playerId) return false;
    const player = this.session.players.find(p => p.id === this.playerId);
    return player?.isHost || false;
  }

  getHostPlayer() {
    if (!this.session?.players) return null;
    return this.session.players.find(p => p.isHost) || null;
  }

  // Cleanup
  reset() {
    this.stopTicker();
    this.session = null;
    this.storySegments = [];
    this.recentInputs = [];
    this.playerGoals = [];
    this.statusMessage = '';
    this.timeRemaining = 0;
    this.emit('change', { type: 'reset' });
  }

  destroy() {
    this.stopTicker();
    this.removeAllListeners();
  }
}

module.exports = UIState;
