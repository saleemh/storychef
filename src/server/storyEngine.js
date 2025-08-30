const EventEmitter = require('events');
const Utils = require('../shared/utils');

class StoryEngine extends EventEmitter {
  constructor(config, liteLLMBridge, logger) {
    super();
    this.config = config;
    this.ai = liteLLMBridge;
    this.logger = logger;
    
    // Active sessions map: sessionId -> engine state
    this.activeSessions = new Map();
  }

  startSession(sessionId, sessionManager) {
    if (this.activeSessions.has(sessionId)) {
      this.logger.warn('Story engine already running for session', sessionId);
      return false;
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      this.logger.error('Cannot start story engine: session not found', sessionId);
      return false;
    }

    const engineState = {
      sessionId,
      sessionManager,
      timer: null,
      segmentTimer: null,
      isRunning: false,
      currentSegment: 0,
      lastGenerationTime: null,
      pendingGeneration: false
    };

    this.activeSessions.set(sessionId, engineState);
    this.logger.info('Story engine initialized', sessionId);

    // Start seeding phase timer
    this.startSeedingPhase(sessionId);
    
    return true;
  }

  startSeedingPhase(sessionId) {
    const engineState = this.activeSessions.get(sessionId);
    if (!engineState) return;

    const session = engineState.sessionManager.getSession(sessionId);
    if (!session) return;

    this.logger.info('Starting seeding phase', sessionId);
    
    // Set seeding phase timer
    const seedingTime = this.config.storyPacing.seedingTime;
    
    // Update session manager with seeding timer
    engineState.sessionManager.setSeedingTimer(sessionId, seedingTime);
    
    engineState.timer = setTimeout(() => {
      this.endSeedingPhase(sessionId);
    }, seedingTime);
  }

  endSeedingPhase(sessionId, forceStart = false) {
    const engineState = this.activeSessions.get(sessionId);
    if (!engineState) return;

    const session = engineState.sessionManager.getSession(sessionId);
    if (!session) return;

    // Clear seeding timer
    if (engineState.timer) {
      clearTimeout(engineState.timer);
      engineState.timer = null;
    }

    // Check if we have at least one seed or force start
    const hasSeeds = session.pendingInputs.seeds.length > 0;
    
    if (!hasSeeds && !forceStart) {
      this.logger.warn('No seeds provided, extending seeding time', sessionId);
      // Extend seeding time by 15 seconds
      engineState.timer = setTimeout(() => {
        this.endSeedingPhase(sessionId, true);
      }, 15000);
      return;
    }

    this.logger.info('Seeding phase completed, starting story generation', sessionId);
    
    // Mark story as started in session manager
    engineState.sessionManager.startStory(sessionId);
    
    // Start continuous story generation
    this.startStoryGeneration(sessionId);
  }

  startStoryGeneration(sessionId) {
    const engineState = this.activeSessions.get(sessionId);
    if (!engineState) return;

    engineState.isRunning = true;
    engineState.lastGenerationTime = new Date();

    this.logger.info('Starting continuous story generation', sessionId);
    
    // Generate initial segment immediately
    this.generateNextSegment(sessionId);
    
    // Set up continuous generation timer
    this.scheduleNextSegment(sessionId);
  }

  resumeStoryGeneration(sessionId) {
    const engineState = this.activeSessions.get(sessionId);
    if (!engineState) return;

    const session = engineState.sessionManager.getSession(sessionId);
    if (!session || session.storyState.isCompleted) return;

    // Check if story generation was paused due to no players
    const connectedPlayers = Array.from(session.players.values()).filter(p => p.isConnected);
    if (connectedPlayers.length > 0 && engineState.isRunning && !engineState.segmentTimer) {
      this.logger.info('Resuming story generation - players reconnected', sessionId);
      this.scheduleNextSegment(sessionId);
    }
  }

  scheduleNextSegment(sessionId) {
    const engineState = this.activeSessions.get(sessionId);
    if (!engineState || !engineState.isRunning) return;

    const session = engineState.sessionManager.getSession(sessionId);
    if (!session || session.storyState.isCompleted) return;

    // Check if any players are still connected (players is a Map)
    const connectedPlayers = Array.from(session.players.values()).filter(p => p && p.isConnected);
    
    // Debug logging to understand the session structure
    this.logger.debug(`Players check: total=${session.players.size}, connected=${connectedPlayers.length}`, sessionId);
    
    if (connectedPlayers.length === 0) {
      this.logger.info('Pausing story generation - no connected players', sessionId);
      // We'll resume when a player reconnects (handled by session manager)
      return;
    }

    const segmentDelay = this.config.storyPacing.segmentDelay;

    // Update session manager with segment timer
    engineState.sessionManager.setNextSegmentTime(sessionId, segmentDelay);

    engineState.segmentTimer = setTimeout(() => {
      this.generateNextSegment(sessionId);
    }, segmentDelay);
  }

  async generateNextSegment(sessionId) {
    const engineState = this.activeSessions.get(sessionId);
    if (!engineState || engineState.pendingGeneration) return;

    const session = engineState.sessionManager.getSession(sessionId);
    if (!session) return;

    // Check if any players are still connected
    const connectedPlayers = session.players ? Array.from(session.players.values()).filter(p => p && p.isConnected) : [];
    
    // Debug logging to understand the session structure
    this.logger.debug(`Generate segment players check: total=${session.players ? session.players.size : 0}, connected=${connectedPlayers.length}`, sessionId);
    
    if (connectedPlayers.length === 0) {
      this.logger.info('Skipping segment generation - no connected players', sessionId);
      // Don't schedule next segment - will resume when players reconnected
      return;
    }

    // Check if story should be completed
    const storyStartTime = session.storyState.storyStartTime;
    const storyTimeLimit = this.config.storyPacing.storyTimeLimit;
    const now = new Date();
    
    if (storyStartTime && (now - storyStartTime) >= storyTimeLimit) {
      this.completeStory(sessionId);
      return;
    }

    engineState.pendingGeneration = true;
    engineState.currentSegment++;

    try {
      this.logger.debug(`Generating segment ${engineState.currentSegment}`, sessionId);
      
      const segment = await this.generateStorySegment(session, engineState.currentSegment);
      
      // Clear current timer and add segment to session
      engineState.sessionManager.clearSegmentTimer(sessionId);
      engineState.sessionManager.addStorySegment(sessionId, segment);
      
      this.logger.info(`Generated segment ${engineState.currentSegment}`, sessionId);
      this.emit('segment_generated', { sessionId, segment, segmentNumber: engineState.currentSegment });
      
    } catch (error) {
      this.logger.error(`Failed to generate segment ${engineState.currentSegment}: ${error.message}`, sessionId);
      this.emit('generation_error', { sessionId, error, segmentNumber: engineState.currentSegment });
      
      // Try to continue with next segment after a delay
      setTimeout(() => {
        engineState.pendingGeneration = false;
        this.scheduleNextSegment(sessionId);
      }, 5000);
      return;
    }

    engineState.pendingGeneration = false;
    engineState.lastGenerationTime = new Date();
    
    // Schedule next segment if story is still active
    if (engineState.isRunning) {
      this.scheduleNextSegment(sessionId);
    }
  }

  async generateStorySegment(session, segmentNumber) {
    const hasDirectInputs = session.pendingInputs.direct.length > 0;
    const template = hasDirectInputs ? 'story_segment_with_direct' : 'story_segment_generation';
    
    // Build story context from recent segments
    const storyContext = this.buildStoryContext(session);
    
    // Format player influences
    this.logger.debug(`Raw pending influences: ${JSON.stringify(session.pendingInputs.influence)}`, sessionId);
    const playerInfluences = this.formatInfluences(session.pendingInputs.influence, sessionId);
    
    // Format direct content if available
    const playerDirectContent = hasDirectInputs ? 
      this.formatDirectContent(session.pendingInputs.direct) : '';
    
    // Prepare variables for AI generation
    const variables = {
      model_provider: this.config.aiModel.provider,
      model_name: this.config.aiModel.model,
      temperature: this.config.aiModel.temperature,
      max_tokens: this.config.aiModel.maxTokens,
      story_context: storyContext,
      player_influences: playerInfluences,
      player_direct_content: playerDirectContent
    };
    
    this.logger.debug(`AI variables prepared - player_influences: "${playerInfluences}"`, sessionId);

    // Call AI to generate segment
    const result = await this.ai.executeTemplate(template, variables);
    
    if (!result.success) {
      throw new Error(result.error || 'AI generation failed');
    }

    const segment = {
      text: result.content,
      timestamp: new Date(),
      segmentNumber: segmentNumber,
      template: template,
      playersInvolved: this.getInvolvedPlayers(session),
      inputsProcessed: {
        direct: session.pendingInputs.direct.length,
        influence: session.pendingInputs.influence.length
      }
    };

    return segment;
  }

  buildStoryContext(session, maxSegments = 3) {
    // Include story seeds at the beginning
    let context = '';
    
    if (session.pendingInputs.seeds.length > 0) {
      context = 'Story Foundation:\n';
      session.pendingInputs.seeds.forEach(seed => {
        context += `- ${seed.content}\n`;
      });
      context += '\n';
    }

    // Add recent story segments
    if (session.storyState.segments.length > 0) {
      const recentSegments = session.storyState.segments.slice(-maxSegments);
      context += 'Recent Story:\n';
      recentSegments.forEach(segment => {
        context += `${segment.text}\n\n`;
      });
    }

    return context.trim();
  }

  formatInfluences(influences, sessionId = null) {
    this.logger.debug(`Formatting ${influences.length} influences: ${JSON.stringify(influences)}`, sessionId);
    
    if (influences.length === 0) {
      this.logger.debug('No influences to format, returning "None"', sessionId);
      return 'None';
    }
    
    const formatted = influences.map(input => 
      `${input.playerName}: ${input.content}`
    ).join('\n');
    
    this.logger.debug(`Formatted influences: ${formatted}`, sessionId);
    return formatted;
  }

  formatDirectContent(directInputs) {
    if (directInputs.length === 0) return '';
    
    return directInputs.map(input => 
      `${input.playerName}: "${input.content}"`
    ).join('\n');
  }

  getInvolvedPlayers(session) {
    const playerNames = new Set();
    
    // Add players who provided inputs
    [...session.pendingInputs.direct, ...session.pendingInputs.influence].forEach(input => {
      playerNames.add(input.playerName);
    });
    
    return Array.from(playerNames);
  }

  async completeStory(sessionId) {
    const engineState = this.activeSessions.get(sessionId);
    if (!engineState) return;

    const session = engineState.sessionManager.getSession(sessionId);
    if (!session) return;

    this.logger.info('Completing story', sessionId);
    
    // Stop timers
    if (engineState.timer) {
      clearTimeout(engineState.timer);
    }
    if (engineState.segmentTimer) {
      clearTimeout(engineState.segmentTimer);
    }
    
    engineState.isRunning = false;

    try {
      // Generate conclusion segment
      const conclusionSegment = await this.generateConclusion(session, sessionId);
      
      // Add conclusion to session
      engineState.sessionManager.addStorySegment(sessionId, conclusionSegment);
      
      // Mark story as completed
      engineState.sessionManager.completeStory(sessionId);
      
      this.logger.info('Story completed successfully', sessionId);
      this.emit('story_completed', { sessionId, totalSegments: engineState.currentSegment + 1 });
      
    } catch (error) {
      this.logger.error(`Failed to generate story conclusion: ${error.message}`, sessionId);
      
      // Complete story anyway without conclusion
      engineState.sessionManager.completeStory(sessionId);
      this.emit('story_completed', { sessionId, totalSegments: engineState.currentSegment, error });
    }

    // Clean up engine state
    this.stopSession(sessionId);
  }

  async generateConclusion(session, sessionId) {
    const storyContext = this.buildStoryContext(session, 5); // Use more context for conclusion
    const playerInfluences = this.formatInfluences(session.pendingInputs.influence, sessionId);
    const playerDirectContent = this.formatDirectContent(session.pendingInputs.direct);
    
    const variables = {
      model_provider: this.config.aiModel.provider,
      model_name: this.config.aiModel.model,
      temperature: this.config.aiModel.temperature,
      max_tokens: this.config.aiModel.maxTokens,
      story_context: storyContext,
      player_influences: playerInfluences,
      player_direct_content: playerDirectContent
    };

    const result = await this.ai.executeTemplate('story_conclusion', variables);
    
    if (!result.success) {
      throw new Error(result.error || 'Conclusion generation failed');
    }

    return {
      text: result.content,
      timestamp: new Date(),
      segmentNumber: -1, // Special marker for conclusion
      template: 'story_conclusion',
      isConclusion: true
    };
  }

  stopSession(sessionId) {
    const engineState = this.activeSessions.get(sessionId);
    if (!engineState) return false;

    this.logger.info('Stopping story engine', sessionId);
    
    // Clear all timers
    if (engineState.timer) {
      clearTimeout(engineState.timer);
    }
    if (engineState.segmentTimer) {
      clearTimeout(engineState.segmentTimer);
    }
    
    engineState.isRunning = false;
    this.activeSessions.delete(sessionId);
    
    this.emit('session_stopped', { sessionId });
    return true;
  }

  // Manual control methods
  skipToNextSegment(sessionId) {
    const engineState = this.activeSessions.get(sessionId);
    if (!engineState || !engineState.isRunning) return false;

    // Clear current segment timer
    if (engineState.segmentTimer) {
      clearTimeout(engineState.segmentTimer);
    }

    // Generate next segment immediately
    this.generateNextSegment(sessionId);
    return true;
  }

  forceStartStory(sessionId) {
    this.endSeedingPhase(sessionId, true);
  }

  // Status and utility methods
  isSessionActive(sessionId) {
    const engineState = this.activeSessions.get(sessionId);
    return engineState?.isRunning || false;
  }

  getSessionStats(sessionId) {
    const engineState = this.activeSessions.get(sessionId);
    if (!engineState) return null;

    return {
      sessionId,
      isRunning: engineState.isRunning,
      currentSegment: engineState.currentSegment,
      lastGenerationTime: engineState.lastGenerationTime,
      pendingGeneration: engineState.pendingGeneration
    };
  }

  getAllSessionStats() {
    return Array.from(this.activeSessions.keys()).map(sessionId => 
      this.getSessionStats(sessionId)
    ).filter(Boolean);
  }

  shutdown() {
    this.logger.info(`Shutting down story engine (${this.activeSessions.size} active sessions)`);
    
    // Stop all active sessions
    for (const sessionId of this.activeSessions.keys()) {
      this.stopSession(sessionId);
    }
    
    this.activeSessions.clear();
  }
}

module.exports = StoryEngine;
