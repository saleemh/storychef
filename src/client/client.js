const { io } = require('socket.io-client');
const EventEmitter = require('events');
const Utils = require('../shared/utils');

class StoryChefClient extends EventEmitter {
  constructor(serverUrl = 'ws://localhost:3333') {
    super();
    this.serverUrl = serverUrl;
    this.socket = null;
    this.playerId = null;
    this.sessionId = null;
    this.playerName = null;
    this.isConnected = false;
    this.session = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.emit('connected');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        this.isConnected = false;
        this.emit('connection_error', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        this.emit('disconnected', reason);
      });

      this.setupSocketHandlers();
    });
  }

  setupSocketHandlers() {
    // Session events
    this.socket.on('session_update', (sessionData) => {
      this.session = sessionData;
      this.emit('session_updated', sessionData);
    });

    this.socket.on('player_joined', (data) => {
      this.emit('player_joined', data);
    });

    this.socket.on('player_left', (data) => {
      this.emit('player_left', data);
    });

    // Story events
    this.socket.on('story_started', () => {
      this.emit('story_started');
    });

    this.socket.on('story_segment', (data) => {
      this.emit('story_segment', data);
    });

    this.socket.on('story_complete', (data) => {
      this.emit('story_complete', data);
    });

    // Input events
    this.socket.on('seed_added', (data) => {
      this.emit('seed_added', data);
    });

    this.socket.on('direct_input_added', (data) => {
      this.emit('direct_input_added', data);
    });

    this.socket.on('influence_input_added', (data) => {
      this.emit('influence_input_added', data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      this.emit('error', error);
    });
  }

  async createSession(playerName) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.playerName = playerName;
      
      this.socket.emit('create_session', { playerName }, (response) => {
        if (response.success) {
          this.sessionId = response.sessionId;
          this.playerId = response.playerId;
          this.session = response.session;
          this.emit('session_created', response);
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  async joinSession(sessionId, playerName) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Not connected to server'));
        return;
      }

      if (!Utils.isValidSessionCode(sessionId)) {
        reject(new Error('Invalid session code format'));
        return;
      }

      this.playerName = playerName;
      
      this.socket.emit('join_session', { sessionId, playerName }, (response) => {
        if (response.success) {
          this.sessionId = response.sessionId;
          this.playerId = response.playerId;
          this.session = response.session;
          this.emit('session_joined', response);
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  async submitStorySeed(content) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.sessionId) {
        reject(new Error('Not connected to a session'));
        return;
      }

      const sanitizedContent = Utils.sanitizeInput(content, 500);
      
      this.socket.emit('story_seed', { content: sanitizedContent }, (response) => {
        if (response.success) {
          this.emit('seed_submitted', { content: sanitizedContent });
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to submit seed'));
        }
      });
    });
  }

  async submitDirectInput(content) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.sessionId) {
        reject(new Error('Not connected to a session'));
        return;
      }

      const sanitizedContent = Utils.sanitizeInput(content, 1000);
      
      this.socket.emit('direct_input', { content: sanitizedContent }, (response) => {
        if (response.success) {
          this.emit('direct_input_submitted', { content: sanitizedContent });
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to submit direct input'));
        }
      });
    });
  }

  async submitInfluenceInput(content) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.sessionId) {
        reject(new Error('Not connected to a session'));
        return;
      }

      const sanitizedContent = Utils.sanitizeInput(content, 1000);
      
      this.socket.emit('influence_input', { content: sanitizedContent }, (response) => {
        if (response.success) {
          this.emit('influence_input_submitted', { content: sanitizedContent });
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to submit influence input'));
        }
      });
    });
  }

  async startStory() {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.sessionId) {
        reject(new Error('Not connected to a session'));
        return;
      }

      this.socket.emit('start_story', {}, (response) => {
        if (response.success) {
          this.emit('story_start_requested');
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to start story'));
        }
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.playerId = null;
    this.sessionId = null;
    this.playerName = null;
    this.session = null;
  }

  // Getter methods
  getSessionId() {
    return this.sessionId;
  }

  getPlayerId() {
    return this.playerId;
  }

  getPlayerName() {
    return this.playerName;
  }

  getSession() {
    return this.session;
  }

  isHost() {
    if (!this.session || !this.playerId) return false;
    
    const player = this.session.players.find(p => p.id === this.playerId);
    return player?.isHost || false;
  }

  getConnectedPlayerCount() {
    if (!this.session) return 0;
    return this.session.players.filter(p => p.isConnected).length;
  }
}

module.exports = StoryChefClient;