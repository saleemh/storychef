const Utils = require('../shared/utils');

class InputProcessor {
  constructor(client) {
    this.client = client;
    this.currentMode = 'influence'; // 'direct' or 'influence'
    this.inputHistory = [];
    this.maxHistorySize = 50;
  }

  setInputMode(mode) {
    if (mode !== 'direct' && mode !== 'influence') {
      throw new Error(`Invalid input mode: ${mode}. Must be 'direct' or 'influence'`);
    }
    
    const previousMode = this.currentMode;
    this.currentMode = mode;
    
    return {
      changed: previousMode !== mode,
      previousMode,
      currentMode: this.currentMode
    };
  }

  toggleInputMode() {
    const newMode = this.currentMode === 'direct' ? 'influence' : 'direct';
    return this.setInputMode(newMode);
  }

  getCurrentMode() {
    return this.currentMode;
  }

  async processInput(rawInput) {
    const session = this.client.getSession();
    
    if (!session) {
      throw new Error('Not connected to a session');
    }

    // Validate and sanitize input
    const validatedInput = this.validateInput(rawInput);
    
    // Add to history
    this.addToHistory({
      content: validatedInput.content,
      mode: this.currentMode,
      timestamp: new Date(),
      wordCount: validatedInput.wordCount
    });

    try {
      let result;
      
      if (session.storyState.seedingPhase) {
        // During seeding phase, all input is treated as story seeds
        result = await this.client.submitStorySeed(validatedInput.content);
        result.inputType = 'seed';
      } else {
        // Regular story phase - use current input mode
        if (this.currentMode === 'direct') {
          result = await this.client.submitDirectInput(validatedInput.content);
          result.inputType = 'direct';
        } else {
          result = await this.client.submitInfluenceInput(validatedInput.content);
          result.inputType = 'influence';
        }
      }

      return {
        success: true,
        inputType: result.inputType,
        content: validatedInput.content,
        wordCount: validatedInput.wordCount,
        mode: this.currentMode
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        inputType: session.storyState.seedingPhase ? 'seed' : this.currentMode,
        content: validatedInput.content
      };
    }
  }

  validateInput(rawInput) {
    if (typeof rawInput !== 'string') {
      throw new Error('Input must be a string');
    }

    const trimmed = rawInput.trim();
    
    if (trimmed.length === 0) {
      throw new Error('Input cannot be empty');
    }

    const session = this.client.getSession();
    let maxLength = 1000; // Default
    let minLength = 1;

    if (session?.storyState.seedingPhase) {
      maxLength = 500; // Story seeds are shorter
      minLength = 10;  // Seeds should have some substance
    } else if (this.currentMode === 'direct') {
      maxLength = 1000; // Direct story contributions can be longer
      minLength = 5;
    } else {
      maxLength = 800; // Influences can be substantial but not as long as direct
      minLength = 3;
    }

    if (trimmed.length < minLength) {
      throw new Error(`Input too short. Minimum ${minLength} characters required.`);
    }

    if (trimmed.length > maxLength) {
      throw new Error(`Input too long. Maximum ${maxLength} characters allowed.`);
    }

    // Additional validation for different input types
    if (session?.storyState.seedingPhase) {
      this.validateSeedInput(trimmed);
    } else if (this.currentMode === 'direct') {
      this.validateDirectInput(trimmed);
    } else {
      this.validateInfluenceInput(trimmed);
    }

    const sanitizedContent = Utils.sanitizeInput(trimmed, maxLength);
    const wordCount = Utils.countWords(sanitizedContent);

    return {
      content: sanitizedContent,
      wordCount,
      originalLength: trimmed.length,
      sanitizedLength: sanitizedContent.length
    };
  }

  validateSeedInput(content) {
    // Story seeds should be descriptive narrative foundations
    if (content.length < 10) {
      throw new Error('Story seeds should be more descriptive');
    }

    // Check for overly short sentences that might not be seeds
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 1 && sentences[0].trim().split(/\s+/).length < 3) {
      throw new Error('Story seeds should provide context and setting details');
    }
  }

  validateDirectInput(content) {
    // Direct inputs should feel like story text
    // Basic check: should not be just commands or meta-comments
    const lowerContent = content.toLowerCase();
    
    const metaPatterns = [
      /^(make|let|have|should|maybe|perhaps|what if)/,
      /^(the story should|i think|how about)/,
      /^(can we|could we|why don't)/
    ];

    for (const pattern of metaPatterns) {
      if (pattern.test(lowerContent)) {
        throw new Error('Direct mode is for story text. Use Influence mode for suggestions.');
      }
    }
  }

  validateInfluenceInput(content) {
    // Influence inputs are more flexible - can be suggestions, directions, themes
    // Just ensure they're not trying to write direct story text in influence mode
    const lowerContent = content.toLowerCase();
    
    // Check for obvious direct story text (past tense narrative)
    if (content.includes('"') && content.includes('said') || 
        content.includes('"') && content.includes('asked')) {
      throw new Error('Dialogue should be submitted in Direct mode, not Influence mode.');
    }
  }

  addToHistory(entry) {
    this.inputHistory.unshift(entry);
    
    if (this.inputHistory.length > this.maxHistorySize) {
      this.inputHistory = this.inputHistory.slice(0, this.maxHistorySize);
    }
  }

  getHistory(limit = 10) {
    return this.inputHistory.slice(0, limit);
  }

  getHistoryByMode(mode, limit = 10) {
    return this.inputHistory
      .filter(entry => entry.mode === mode)
      .slice(0, limit);
  }

  getSessionStats() {
    const session = this.client.getSession();
    const playerId = this.client.getPlayerId();
    
    if (!session || !playerId) {
      return null;
    }

    // Count inputs by mode from history
    const directCount = this.inputHistory.filter(h => h.mode === 'direct').length;
    const influenceCount = this.inputHistory.filter(h => h.mode === 'influence').length;
    const seedCount = this.inputHistory.filter(h => h.mode === 'seed').length;
    
    // Calculate word counts
    const directWords = this.inputHistory
      .filter(h => h.mode === 'direct')
      .reduce((sum, h) => sum + h.wordCount, 0);
    
    const influenceWords = this.inputHistory
      .filter(h => h.mode === 'influence')
      .reduce((sum, h) => sum + h.wordCount, 0);
    
    const seedWords = this.inputHistory
      .filter(h => h.mode === 'seed')
      .reduce((sum, h) => sum + h.wordCount, 0);

    return {
      playerId,
      playerName: this.client.getPlayerName(),
      currentMode: this.currentMode,
      totalInputs: this.inputHistory.length,
      inputCounts: {
        direct: directCount,
        influence: influenceCount,
        seed: seedCount
      },
      wordCounts: {
        direct: directWords,
        influence: influenceWords,
        seed: seedWords,
        total: directWords + influenceWords + seedWords
      },
      averageWordsPerInput: this.inputHistory.length > 0 ? 
        Math.round((directWords + influenceWords + seedWords) / this.inputHistory.length) : 0
    };
  }

  getModeDescription(mode = null) {
    const targetMode = mode || this.currentMode;
    
    const descriptions = {
      'direct': {
        name: 'Direct Story Writing',
        description: 'Write exact text to include in the story. This becomes part of the narrative.',
        example: 'Sarah opened the ancient book and gasped as golden light spilled from its pages.',
        tips: [
          'Write in narrative style',
          'Use past tense typically',
          'Can include dialogue and descriptions',
          'Focus on actions, settings, and character interactions'
        ]
      },
      'influence': {
        name: 'Story Influence',
        description: 'Suggest themes, directions, and story elements for the AI to incorporate.',
        example: 'The protagonist should discover something magical, maybe related to time travel.',
        tips: [
          'Suggest plot directions',
          'Recommend character developments',
          'Propose themes and moods',
          'Guide story pacing and tone'
        ]
      },
      'seed': {
        name: 'Story Seeding',
        description: 'Provide the initial foundation and setting for the collaborative story.',
        example: 'In a Victorian-era city where steam powers magical machines, an inventor discovers...',
        tips: [
          'Establish setting and time period',
          'Introduce main characters',
          'Set up the initial situation',
          'Create an intriguing premise'
        ]
      }
    };

    return descriptions[targetMode] || descriptions['influence'];
  }

  clearHistory() {
    this.inputHistory = [];
  }

  // Utility methods for the UI
  getInputModeDisplay() {
    const session = this.client.getSession();
    
    if (session?.storyState.seedingPhase) {
      return 'SEEDING';
    }
    
    return this.currentMode.toUpperCase();
  }

  getInputLabel() {
    const session = this.client.getSession();
    
    if (session?.storyState.seedingPhase) {
      return 'Type your story seed';
    }
    
    return `Type your ${this.currentMode}`;
  }

  getNextModeHint() {
    if (this.currentMode === 'direct') {
      return 'Press Tab for Influence mode';
    } else {
      return 'Press Tab for Direct mode';
    }
  }
}

module.exports = InputProcessor;