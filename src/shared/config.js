const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor(configPath = './story-chef.config.json') {
    this.configPath = path.resolve(configPath);
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      this.validateConfig(config);
      return config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`Configuration file not found at ${this.configPath}. Using default config.`);
        return this.getDefaultConfig();
      }
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  getDefaultConfig() {
    return {
      aiModel: {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.8,
        maxTokens: 300
      },
      prompts: {
        configFile: "./prompts/story-prompts.pdl"
      },
      storyPacing: {
        seedingTime: 30000,
        segmentDelay: 30000,
        segmentLength: "4-6 sentences",
        storyTimeLimit: 600000
      },
      server: {
        port: 3000,
        maxPlayers: 100,
        maxConcurrentSessions: 50,
        allowLateJoins: true,
        reconnectTimeout: 60000,
        logLevel: "info",
        sessionCleanupInterval: 300000,
        aiRequestQueue: {
          maxConcurrent: 10,
          timeout: 30000
        }
      },
      webFrontend: {
        enabled: false,
        port: 3001,
        staticPath: "./web"
      },
      competition: {
        enabled: false,
        goalsPerPlayer: 5,
        difficulty: "medium",
        globalLeaderboard: true
      }
    };
  }

  validateConfig(config) {
    const requiredKeys = [
      'aiModel', 'prompts', 'storyPacing', 'server', 'webFrontend', 'competition'
    ];
    
    for (const key of requiredKeys) {
      if (!config[key]) {
        throw new Error(`Missing required configuration section: ${key}`);
      }
    }

    // Validate aiModel section
    if (!config.aiModel.provider || !config.aiModel.model) {
      throw new Error('aiModel must have provider and model specified');
    }

    // Validate server section
    if (typeof config.server.port !== 'number' || config.server.port <= 0) {
      throw new Error('server.port must be a positive number');
    }

    // Validate temperature range
    if (config.aiModel.temperature < 0 || config.aiModel.temperature > 2) {
      throw new Error('aiModel.temperature must be between 0 and 2');
    }

    // Validate difficulty level
    const validDifficulties = ['easy', 'medium', 'hard'];
    if (!validDifficulties.includes(config.competition.difficulty)) {
      throw new Error(`competition.difficulty must be one of: ${validDifficulties.join(', ')}`);
    }
  }

  saveConfig() {
    try {
      const configData = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, configData, 'utf8');
      return true;
    } catch (error) {
      console.error(`Failed to save configuration: ${error.message}`);
      return false;
    }
  }

  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    this.validateConfig(this.config);
    return this.saveConfig();
  }

  getConfig() {
    return { ...this.config };
  }

  get(keyPath) {
    const keys = keyPath.split('.');
    let value = this.config;
    
    for (const key of keys) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[key];
    }
    
    return value;
  }

  set(keyPath, value) {
    const keys = keyPath.split('.');
    const lastKey = keys.pop();
    let target = this.config;
    
    for (const key of keys) {
      if (target[key] === null || target[key] === undefined) {
        target[key] = {};
      }
      target = target[key];
    }
    
    target[lastKey] = value;
    this.validateConfig(this.config);
    return this.saveConfig();
  }
}

module.exports = ConfigManager;