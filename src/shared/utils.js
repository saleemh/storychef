const crypto = require('crypto');

class Utils {
  // Generate session IDs with random word format like "MAGIC-FOREST-7429"
  static generateSessionId() {
    const words = [
      'MAGIC', 'FOREST', 'OCEAN', 'QUEST', 'SPACE', 'ODYSSEY', 'DRAGON', 'CASTLE',
      'CRYSTAL', 'SHADOW', 'GOLDEN', 'SILVER', 'MYSTIC', 'ANCIENT', 'ROYAL', 'STORM',
      'FIRE', 'ICE', 'THUNDER', 'LIGHTNING', 'STAR', 'MOON', 'SUN', 'WIND',
      'DREAM', 'VISION', 'WHISPER', 'ECHO', 'SPIRIT', 'SOUL', 'HEART', 'MIND'
    ];

    const word1 = words[Math.floor(Math.random() * words.length)];
    let word2;
    do {
      word2 = words[Math.floor(Math.random() * words.length)];
    } while (word2 === word1);
    
    const numbers = Math.floor(1000 + Math.random() * 9000); // 4-digit number
    return `${word1}-${word2}-${numbers}`;
  }

  // Generate unique player IDs
  static generatePlayerId() {
    return `player_${crypto.randomBytes(8).toString('hex')}`;
  }

  // Format time remaining in MM:SS format
  static formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Sanitize user input
  static sanitizeInput(input, maxLength = 1000) {
    if (typeof input !== 'string') return '';
    
    return input
      .slice(0, maxLength)
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .trim();
  }

  // Parse goals from AI response
  static parseGoals(aiResponse) {
    const lines = aiResponse.split('\n');
    const goals = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for numbered list items or bullet points
      const goalMatch = trimmed.match(/^[\d\-\*•]\s*(.+)$/) || 
                       trimmed.match(/^["'](.+)["']$/) ||
                       (trimmed.length > 10 && !trimmed.includes(':') ? [null, trimmed] : null);
      
      if (goalMatch && goalMatch[1]) {
        const goal = goalMatch[1].replace(/^["']|["']$/g, '').trim();
        if (goal.length > 10) {
          goals.push(goal);
        }
      }
    }
    
    return goals;
  }

  // Calculate word count
  static countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  // Extract themes from contributions
  static extractThemes(contributions) {
    if (!contributions || contributions.length === 0) return [];
    
    const allText = contributions.join(' ').toLowerCase();
    const themes = [];
    
    // Simple keyword matching for themes
    const themeKeywords = {
      'magic': ['magic', 'spell', 'wizard', 'enchant', 'mystical', 'potion'],
      'adventure': ['journey', 'quest', 'explore', 'discover', 'travel'],
      'mystery': ['secret', 'hidden', 'mystery', 'clue', 'investigate'],
      'character': ['friend', 'character', 'person', 'hero', 'villain'],
      'emotion': ['feel', 'emotion', 'happy', 'sad', 'fear', 'love', 'angry'],
      'action': ['fight', 'run', 'jump', 'battle', 'escape', 'chase']
    };
    
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(keyword => allText.includes(keyword))) {
        themes.push(theme);
      }
    }
    
    return themes.slice(0, 3); // Return top 3 themes
  }

  // Get current timestamp for logging
  static getTimestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }

  // Sleep utility for async operations
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Deep clone object
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Validate session code format
  static isValidSessionCode(code) {
    return /^[A-Z]+-[A-Z]+-\d{4}$/.test(code);
  }

  // Get IP address from socket
  static getClientIP(socket) {
    return socket.handshake.headers['x-forwarded-for'] || 
           socket.handshake.address || 
           socket.conn.remoteAddress || 
           'unknown';
  }
}

module.exports = Utils;