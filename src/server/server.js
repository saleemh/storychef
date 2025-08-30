const { Server } = require('socket.io');
const http = require('http');
const ConfigManager = require('../shared/config');
const Logger = require('./logger');
const SessionManager = require('./sessionManager');
const LiteLLMBridge = require('./aiQueue');
const StoryEngine = require('./storyEngine');
const Utils = require('../shared/utils');

class StoryChefServer {
  constructor(configPath) {
    this.config = new ConfigManager(configPath);
    this.logger = new Logger(this.config.getConfig());
    this.sessionManager = new SessionManager(this.config.getConfig(), this.logger);
    this.liteLLMBridge = new LiteLLMBridge(this.config.getConfig());
    this.storyEngine = new StoryEngine(this.config.getConfig(), this.liteLLMBridge, this.logger);
    
    this.server = null;
    this.io = null;
    
    this.setupEventHandlers();
  }

  async start() {
    const config = this.config.getConfig();
    
    // Test LiteLLM connection
    this.logger.info('Testing LiteLLM bridge connection...');
    const bridgeTest = await this.liteLLMBridge.testConnection();
    if (bridgeTest.success) {
      this.logger.info('LiteLLM bridge connection successful');
    } else {
      this.logger.warn(`LiteLLM bridge test failed: ${bridgeTest.message}`);
      this.logger.info('Server starting anyway - AI features may not work until bridge is fixed');
    }

    // Create HTTP server
    this.server = http.createServer();
    
    // Create Socket.io server
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupSocketHandlers();

    // Start server
    return new Promise((resolve, reject) => {
      this.server.listen(config.server.port, (err) => {
        if (err) {
          this.logger.error(`Failed to start server: ${err.message}`);
          reject(err);
        } else {
          this.logger.info(`🖥️  Story Chef Server running on port ${config.server.port}`);
          this.logger.info(`📊 Session logging enabled (level: ${config.server.logLevel})`);
          this.logger.info(`🔄 Waiting for client connections...`);
          resolve();
        }
      });
    });
  }

  setupEventHandlers() {
    // Session Manager events
    this.sessionManager.on('session_created', this.handleSessionCreated.bind(this));
    this.sessionManager.on('player_joined', this.handlePlayerJoined.bind(this));
    this.sessionManager.on('player_left', this.handlePlayerLeft.bind(this));
    this.sessionManager.on('player_reconnected', this.handlePlayerReconnected.bind(this));
    this.sessionManager.on('story_started', this.handleStoryStarted.bind(this));
    this.sessionManager.on('segment_added', this.handleSegmentAdded.bind(this));
    this.sessionManager.on('story_completed', this.handleStoryCompleted.bind(this));
    this.sessionManager.on('session_timer_update', this.handleSessionTimerUpdate.bind(this));

    // LiteLLM Bridge events
    this.liteLLMBridge.on('request_started', (data) => {
      this.logger.debug(`AI request started: ${data.templateName} (${data.activeRequests} active)`);
    });

    this.liteLLMBridge.on('request_completed', (data) => {
      this.logger.debug(`AI request completed: ${data.templateName} (${data.activeRequests} active)`);
    });

    this.liteLLMBridge.on('request_failed', (data) => {
      this.logger.error(`AI request failed: ${data.templateName} - ${data.error}`);
    });

    // Story Engine events
    this.storyEngine.on('segment_generated', (data) => {
      this.logger.info(`Story segment generated: ${data.segmentNumber}`, data.sessionId);
    });

    this.storyEngine.on('generation_error', (data) => {
      this.logger.error(`Story generation error: ${data.error.message}`, data.sessionId);
    });

    this.storyEngine.on('story_completed', (data) => {
      this.logger.info(`Story engine completed: ${data.totalSegments} segments`, data.sessionId);
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      this.logger.debug(`New socket connection: ${socket.id}`);

      // Create new session
      socket.on('create_session', async (data, callback) => {
        try {
          const { playerName } = data;
          const playerId = Utils.generatePlayerId();
          const ipAddress = Utils.getClientIP(socket);

          const session = this.sessionManager.createSession(playerId, playerName, ipAddress);
          this.sessionManager.updatePlayerSocket(playerId, socket.id);

          // Store player info in socket
          socket.playerId = playerId;
          socket.sessionId = session.sessionId;
          socket.join(session.sessionId);

          callback({
            success: true,
            sessionId: session.sessionId,
            playerId,
            session: this.getPublicSessionData(session)
          });

        } catch (error) {
          this.logger.error(`Failed to create session: ${error.message}`);
          callback({
            success: false,
            error: error.message
          });
        }
      });

      // Join existing session
      socket.on('join_session', async (data, callback) => {
        try {
          const { sessionId, playerName } = data;
          
          if (!Utils.isValidSessionCode(sessionId)) {
            throw new Error('Invalid session code format');
          }

          const playerId = Utils.generatePlayerId();
          const ipAddress = Utils.getClientIP(socket);

          const session = this.sessionManager.joinSession(sessionId, playerId, playerName, ipAddress);
          this.sessionManager.updatePlayerSocket(playerId, socket.id);

          // Store player info in socket
          socket.playerId = playerId;
          socket.sessionId = sessionId;
          socket.join(sessionId);

          // Notify other players
          socket.to(sessionId).emit('player_joined', {
            playerId,
            playerName,
            playerCount: this.sessionManager.getConnectedPlayerCount(session)
          });

          callback({
            success: true,
            sessionId,
            playerId,
            session: this.getPublicSessionData(session)
          });

        } catch (error) {
          this.logger.error(`Failed to join session: ${error.message}`);
          callback({
            success: false,
            error: error.message
          });
        }
      });

      // Submit story seed
      socket.on('story_seed', async (data, callback) => {
        try {
          const { content } = data;
          const playerId = socket.playerId;
          const sessionId = socket.sessionId;

          if (!playerId || !sessionId) {
            throw new Error('Not connected to a session');
          }

          const success = this.sessionManager.addStoryInput(sessionId, playerId, 'seed', content);
          if (success) {
            // Notify other players about the seed
            socket.to(sessionId).emit('seed_added', {
              playerId,
              content
            });
          }

          callback({ success });

        } catch (error) {
          this.logger.error(`Failed to add story seed: ${error.message}`, socket.sessionId);
          callback({ success: false, error: error.message });
        }
      });

      // Submit direct story input
      socket.on('direct_input', async (data, callback) => {
        try {
          const { content } = data;
          const playerId = socket.playerId;
          const sessionId = socket.sessionId;

          if (!playerId || !sessionId) {
            throw new Error('Not connected to a session');
          }

          const success = this.sessionManager.addStoryInput(sessionId, playerId, 'direct', content);
          if (success) {
            // Notify other players about the input
            socket.to(sessionId).emit('direct_input_added', {
              playerId,
              content
            });
          }

          callback({ success });

        } catch (error) {
          this.logger.error(`Failed to add direct input: ${error.message}`, socket.sessionId);
          callback({ success: false, error: error.message });
        }
      });

      // Submit influence input
      socket.on('influence_input', async (data, callback) => {
        try {
          const { content } = data;
          const playerId = socket.playerId;
          const sessionId = socket.sessionId;

          if (!playerId || !sessionId) {
            throw new Error('Not connected to a session');
          }

          const success = this.sessionManager.addStoryInput(sessionId, playerId, 'influence', content);
          if (success) {
            // Notify other players about the input
            socket.to(sessionId).emit('influence_input_added', {
              playerId,
              content
            });
          }

          callback({ success });

        } catch (error) {
          this.logger.error(`Failed to add influence input: ${error.message}`, socket.sessionId);
          callback({ success: false, error: error.message });
        }
      });

      // Start story (usually after seeding phase)
      socket.on('start_story', async (data, callback) => {
        try {
          const sessionId = socket.sessionId;
          
          if (!sessionId) {
            throw new Error('Not connected to a session');
          }

          const session = this.sessionManager.getSession(sessionId);
          if (!session) {
            throw new Error('Session not found');
          }

          const player = session.players.get(socket.playerId);
          if (!player?.isHost) {
            throw new Error('Only the host can start the story');
          }

          const success = this.sessionManager.startStory(sessionId);
          callback({ success });

        } catch (error) {
          this.logger.error(`Failed to start story: ${error.message}`, socket.sessionId);
          callback({ success: false, error: error.message });
        }
      });

      // Handle disconnections
      socket.on('disconnect', () => {
        this.logger.debug(`Socket disconnected: ${socket.id}`);
        
        if (socket.playerId && socket.sessionId) {
          this.sessionManager.leaveSession(socket.playerId);
          
          // Notify other players
          socket.to(socket.sessionId).emit('player_left', {
            playerId: socket.playerId
          });
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        this.logger.error(`Socket error: ${error.message}`, socket.sessionId);
      });
    });
  }

  // Event handlers for session events
  handleSessionCreated({ sessionId, session }) {
    // Start story engine for this session
    this.storyEngine.startSession(sessionId, this.sessionManager);
  }

  handlePlayerJoined({ sessionId, playerId, playerName }) {
    // Player joined, update all clients in session
    this.updateSessionForClients(sessionId);
    
    // Resume story generation if it was paused
    this.storyEngine.resumeStoryGeneration(sessionId);
  }

  handlePlayerLeft({ sessionId, playerId, playerName }) {
    // Player left, update all clients in session
    this.updateSessionForClients(sessionId);
  }

  handlePlayerReconnected({ sessionId, playerId, playerName }) {
    // Player reconnected, update all clients in session
    this.updateSessionForClients(sessionId);
    
    // Resume story generation if it was paused
    this.storyEngine.resumeStoryGeneration(sessionId);
  }

  handleStoryStarted({ sessionId }) {
    this.io.to(sessionId).emit('story_started');
    this.updateSessionForClients(sessionId);
  }

  handleSegmentAdded({ sessionId, segment, segmentNumber }) {
    this.io.to(sessionId).emit('story_segment', {
      segment,
      segmentNumber
    });
    this.updateSessionForClients(sessionId);
  }

  handleStoryCompleted({ sessionId, session, duration }) {
    this.io.to(sessionId).emit('story_complete', {
      duration,
      segments: session.storyState.segments.length
    });
  }

  handleSessionTimerUpdate({ sessionId }) {
    // Send updated session data to all clients so they get the current timeRemaining
    this.updateSessionForClients(sessionId);
  }

  // Helper methods
  updateSessionForClients(sessionId) {
    const session = this.sessionManager.getSession(sessionId);
    if (session) {
      this.io.to(sessionId).emit('session_update', this.getPublicSessionData(session));
    }
  }

  getPublicSessionData(session) {
    return {
      sessionId: session.sessionId,
      players: Array.from(session.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isConnected: p.isConnected,
        joinedAt: p.joinedAt
      })),
      storyState: {
        segments: session.storyState.segments,
        seedingPhase: session.storyState.seedingPhase,
        isActive: session.storyState.isActive,
        isCompleted: session.storyState.isCompleted,
        timeRemaining: session.storyState.timeRemaining,
        segmentTimeRemaining: session.storyState.segmentTimeRemaining || 0
      },
      competitionMode: session.competitionMode,
      config: {
        storyPacing: session.config.storyPacing,
        competition: session.config.competition
      }
    };
  }

  async stop() {
    this.logger.info('Shutting down Story Chef Server...');
    
    if (this.io) {
      this.io.close();
    }
    
    if (this.server) {
      this.server.close();
    }
    
    this.storyEngine.shutdown();
    this.sessionManager.shutdown();
    this.logger.info('Server shutdown complete');
  }
}

module.exports = StoryChefServer;