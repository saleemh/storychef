const fs = require('fs');
const path = require('path');

class Logger {
  constructor(config) {
    this.logLevel = config?.server?.logLevel || 'info';
    this.logLevels = {
      'error': 0,
      'warn': 1,
      'info': 2,
      'debug': 3
    };
    
    // Ensure logs directory exists
    const logsDir = path.resolve('./logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    this.logFile = path.join(logsDir, `story-chef-${new Date().toISOString().slice(0, 10)}.log`);
  }

  _shouldLog(level) {
    return this.logLevels[level] <= this.logLevels[this.logLevel];
  }

  _formatMessage(level, sessionId, message) {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const sessionPrefix = sessionId ? `[${sessionId}]` : '[SYSTEM]';
    return `[${timestamp}] ${level.toUpperCase()}: ${sessionPrefix} ${message}`;
  }

  _writeToFile(formattedMessage) {
    try {
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }

  error(message, sessionId = null) {
    if (!this._shouldLog('error')) return;
    
    const formattedMessage = this._formatMessage('error', sessionId, message);
    console.error(formattedMessage);
    this._writeToFile(formattedMessage);
  }

  warn(message, sessionId = null) {
    if (!this._shouldLog('warn')) return;
    
    const formattedMessage = this._formatMessage('warn', sessionId, message);
    console.warn(formattedMessage);
    this._writeToFile(formattedMessage);
  }

  info(message, sessionId = null) {
    if (!this._shouldLog('info')) return;
    
    const formattedMessage = this._formatMessage('info', sessionId, message);
    console.log(formattedMessage);
    this._writeToFile(formattedMessage);
  }

  debug(message, sessionId = null) {
    if (!this._shouldLog('debug')) return;
    
    const formattedMessage = this._formatMessage('debug', sessionId, message);
    console.log(formattedMessage);
    this._writeToFile(formattedMessage);
  }

  // Convenience methods for specific events
  sessionCreated(sessionId, playerName, ipAddress) {
    this.info(`New session created by '${playerName}' from ${ipAddress}`, sessionId);
  }

  playerJoined(sessionId, playerName, ipAddress) {
    this.info(`Player '${playerName}' joined from ${ipAddress}`, sessionId);
  }

  playerLeft(sessionId, playerName) {
    this.info(`Player '${playerName}' left the session`, sessionId);
  }

  playerReconnected(sessionId, playerName) {
    this.info(`Player '${playerName}' reconnected successfully`, sessionId);
  }

  storySegmentGenerated(sessionId, segmentNumber, activePlayers) {
    this.info(`Segment ${segmentNumber} generated (${activePlayers} players active)`, sessionId);
  }

  storyCompleted(sessionId, duration, playerCount) {
    this.info(`Story completed - Duration: ${duration}s, Players: ${playerCount}`, sessionId);
  }

  aiError(sessionId, error, template) {
    this.error(`AI generation failed for template '${template}': ${error}`, sessionId);
  }

  connectionError(sessionId, error) {
    this.error(`Connection error: ${error}`, sessionId);
  }
}

module.exports = Logger;