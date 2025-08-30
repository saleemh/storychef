const EventEmitter = require('events');
const Utils = require('../shared/utils');

class SessionManager extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.sessions = new Map();
    this.playerSessions = new Map(); // Maps player IDs to session IDs
    this.cleanupInterval = null;
    
    this.startCleanupTimer();
  }

  createSession(hostPlayerId, playerName, ipAddress) {
    const sessionId = Utils.generateSessionId();
    const timestamp = new Date();
    
    const session = {
      sessionId,
      hostPlayerId,
      players: new Map(),
      storyState: {
        segments: [],
        currentContext: '',
        seedingPhase: true,
        seedingStartTime: timestamp,
        storyStartTime: null,
        timeRemaining: this.config.storyPacing.storyTimeLimit,
        isActive: false,
        isCompleted: false
      },
      pendingInputs: {
        direct: [],
        influence: [],
        seeds: []
      },
      competitionMode: this.config.competition.enabled,
      goals: new Map(), // playerId -> goals array
      createdAt: timestamp,
      lastActivity: timestamp,
      config: { ...this.config } // Session-specific config copy
    };

    // Add host player
    const hostPlayer = {
      id: hostPlayerId,
      name: playerName,
      ipAddress,
      isHost: true,
      joinedAt: timestamp,
      socketId: null,
      isConnected: false,
      contributions: {
        directWords: 0,
        influenceWords: 0,
        inputCount: 0,
        seedWords: 0
      },
      goals: []
    };

    session.players.set(hostPlayerId, hostPlayer);
    this.sessions.set(sessionId, session);
    this.playerSessions.set(hostPlayerId, sessionId);

    this.logger.sessionCreated(sessionId, playerName, ipAddress);
    this.emit('session_created', { sessionId, session });
    
    return session;
  }

  joinSession(sessionId, playerId, playerName, ipAddress) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.storyState.isCompleted) {
      throw new Error('Cannot join completed session');
    }

    if (session.players.size >= this.config.server.maxPlayers) {
      throw new Error('Session is full');
    }

    // Check if this is a reconnecting player
    if (session.players.has(playerId)) {
      const player = session.players.get(playerId);
      player.isConnected = true;
      player.ipAddress = ipAddress; // Update IP in case it changed
      this.logger.playerReconnected(sessionId, playerName);
      this.emit('player_reconnected', { sessionId, playerId, playerName });
      return session;
    }

    // Add new player
    const player = {
      id: playerId,
      name: playerName,
      ipAddress,
      isHost: false,
      joinedAt: new Date(),
      socketId: null,
      isConnected: true,
      contributions: {
        directWords: 0,
        influenceWords: 0,
        inputCount: 0,
        seedWords: 0
      },
      goals: []
    };

    session.players.set(playerId, player);
    this.playerSessions.set(playerId, sessionId);
    session.lastActivity = new Date();

    this.logger.playerJoined(sessionId, playerName, ipAddress);
    this.emit('player_joined', { sessionId, playerId, playerName });
    
    return session;
  }

  leaveSession(playerId) {
    const sessionId = this.playerSessions.get(playerId);
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const player = session.players.get(playerId);
    if (player) {
      player.isConnected = false;
      this.logger.playerLeft(sessionId, player.name);
      this.emit('player_left', { sessionId, playerId, playerName: player.name });
    }

    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getSessionByPlayerId(playerId) {
    const sessionId = this.playerSessions.get(playerId);
    return sessionId ? this.sessions.get(sessionId) : null;
  }

  updatePlayerSocket(playerId, socketId) {
    const sessionId = this.playerSessions.get(playerId);
    if (!sessionId) return false;

    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const player = session.players.get(playerId);
    if (player) {
      player.socketId = socketId;
      player.isConnected = true;
      return true;
    }
    
    return false;
  }

  addStoryInput(sessionId, playerId, inputType, content) {
    const session = this.sessions.get(sessionId);
    if (!session || session.storyState.isCompleted) return false;

    const player = session.players.get(playerId);
    if (!player) return false;

    const input = {
      playerId,
      playerName: player.name,
      content: Utils.sanitizeInput(content),
      timestamp: new Date(),
      type: inputType
    };

    const wordCount = Utils.countWords(content);

    if (inputType === 'direct') {
      session.pendingInputs.direct.push(input);
      player.contributions.directWords += wordCount;
    } else if (inputType === 'influence') {
      session.pendingInputs.influence.push(input);
      player.contributions.influenceWords += wordCount;
    } else if (inputType === 'seed') {
      session.pendingInputs.seeds.push(input);
      player.contributions.seedWords += wordCount;
    }

    player.contributions.inputCount++;
    session.lastActivity = new Date();

    this.emit('input_added', { sessionId, playerId, inputType, content: input.content });
    return true;
  }

  startStory(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.storyState.isActive) return false;

    session.storyState.seedingPhase = false;
    session.storyState.isActive = true;
    session.storyState.storyStartTime = new Date();
    session.lastActivity = new Date();

    this.logger.info(`Story generation started`, sessionId);
    this.emit('story_started', { sessionId });
    
    return true;
  }

  addStorySegment(sessionId, segment) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.storyState.segments.push(segment);
    session.storyState.currentContext = this.buildStoryContext(session);
    session.lastActivity = new Date();

    // Clear processed inputs
    session.pendingInputs.direct = [];
    session.pendingInputs.influence = [];

    const segmentNumber = session.storyState.segments.length;
    const activePlayers = this.getConnectedPlayerCount(session);
    
    this.logger.storySegmentGenerated(sessionId, segmentNumber, activePlayers);
    this.emit('segment_added', { sessionId, segment, segmentNumber });

    return true;
  }

  completeStory(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.storyState.isActive = false;
    session.storyState.isCompleted = true;
    session.storyState.completedAt = new Date();
    
    const duration = session.storyState.storyStartTime ? 
      Math.floor((session.storyState.completedAt - session.storyState.storyStartTime) / 1000) : 0;
    
    this.logger.storyCompleted(sessionId, duration, session.players.size);
    this.emit('story_completed', { sessionId, session, duration });

    return true;
  }

  buildStoryContext(session, maxSegments = 5) {
    const recentSegments = session.storyState.segments.slice(-maxSegments);
    return recentSegments.map(segment => segment.text).join('\n\n');
  }

  getConnectedPlayerCount(session) {
    return Array.from(session.players.values()).filter(p => p.isConnected).length;
  }

  getConnectedPlayers(session) {
    return Array.from(session.players.values()).filter(p => p.isConnected);
  }

  updateSessionActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  startCleanupTimer() {
    const cleanupInterval = this.config.server?.sessionCleanupInterval || 300000; // 5 minutes
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, cleanupInterval);
  }

  cleanupInactiveSessions() {
    const now = new Date();
    const maxInactivity = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of this.sessions) {
      const inactive = (now - session.lastActivity) > maxInactivity;
      const noConnectedPlayers = this.getConnectedPlayerCount(session) === 0;
      
      if ((inactive || noConnectedPlayers) && session.storyState.isCompleted) {
        this.logger.info(`Cleaning up inactive session`, sessionId);
        
        // Remove player mappings
        for (const playerId of session.players.keys()) {
          this.playerSessions.delete(playerId);
        }
        
        // Remove session
        this.sessions.delete(sessionId);
        this.emit('session_cleaned_up', { sessionId });
      }
    }
  }

  getSessionStats() {
    const activeSessions = Array.from(this.sessions.values()).filter(s => !s.storyState.isCompleted);
    const completedSessions = Array.from(this.sessions.values()).filter(s => s.storyState.isCompleted);
    const totalPlayers = Array.from(this.playerSessions.keys()).length;

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      completedSessions: completedSessions.length,
      totalPlayers,
      maxConcurrentSessions: this.config.server.maxConcurrentSessions
    };
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = SessionManager;