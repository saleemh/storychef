const fs = require('fs');
const path = require('path');
const Utils = require('./utils');

class ExportEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    
    // Ensure exports directory exists
    this.exportsDir = path.resolve('./exports');
    if (!fs.existsSync(this.exportsDir)) {
      fs.mkdirSync(this.exportsDir, { recursive: true });
    }
  }

  async exportStorySession(session, competitionResults = null) {
    const sessionId = session.sessionId;
    this.logger.info('Starting story export', sessionId);

    try {
      const exportData = await this.buildExportData(session, competitionResults);
      const markdown = this.generateMarkdown(exportData);
      const filePath = await this.saveMarkdownFile(sessionId, markdown);
      
      this.logger.info(`Story exported successfully to ${filePath}`, sessionId);
      
      return {
        success: true,
        filePath,
        exportData: {
          sessionId,
          playerCount: exportData.players.length,
          storyLength: exportData.storyStats.totalWords,
          segmentCount: exportData.storyStats.totalSegments,
          duration: exportData.sessionInfo.duration,
          competitionMode: exportData.sessionInfo.competitionMode
        }
      };
      
    } catch (error) {
      this.logger.error(`Export failed: ${error.message}`, sessionId);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async buildExportData(session, competitionResults = null) {
    const sessionInfo = this.extractSessionInfo(session);
    const storyData = this.extractStoryData(session);
    const playerData = this.extractPlayerData(session);
    const storyStats = this.calculateStoryStats(storyData, playerData);
    
    const exportData = {
      sessionInfo,
      storyData,
      players: playerData,
      storyStats,
      generatedAt: new Date(),
      exportVersion: '1.0'
    };

    // Add competition data if available
    if (competitionResults) {
      exportData.competition = {
        enabled: true,
        results: competitionResults.leaderboard,
        playerScores: competitionResults.playerScores,
        difficulty: session.config?.competition?.difficulty || 'medium',
        goalsPerPlayer: session.config?.competition?.goalsPerPlayer || 5
      };
    } else {
      exportData.competition = { enabled: false };
    }

    return exportData;
  }

  extractSessionInfo(session) {
    const createdAt = session.createdAt;
    const completedAt = session.storyState.completedAt;
    const duration = completedAt && createdAt ? 
      Math.floor((completedAt - createdAt) / 1000) : 0;

    const storyStartTime = session.storyState.storyStartTime;
    const storyDuration = completedAt && storyStartTime ?
      Math.floor((completedAt - storyStartTime) / 1000) : 0;

    // Find host player
    const hostPlayer = Array.from(session.players.values()).find(p => p.isHost);

    return {
      sessionId: session.sessionId,
      storyTitle: this.generateStoryTitle(session),
      createdAt,
      completedAt,
      duration,
      storyDuration,
      seedingTime: this.config.storyPacing.seedingTime / 1000,
      segmentDelay: this.config.storyPacing.segmentDelay / 1000,
      hostPlayer: hostPlayer ? {
        name: hostPlayer.name,
        id: hostPlayer.id
      } : null,
      competitionMode: session.competitionMode || false,
      serverConfig: {
        aiProvider: this.config.aiModel.provider,
        aiModel: this.config.aiModel.model,
        temperature: this.config.aiModel.temperature
      }
    };
  }

  extractStoryData(session) {
    const storySeeds = session.pendingInputs.seeds || [];
    const segments = session.storyState.segments || [];
    
    // Build full story text
    let fullStory = '';
    
    if (storySeeds.length > 0) {
      fullStory += 'Story Foundation:\n';
      storySeeds.forEach(seed => {
        fullStory += `${seed.content}\n`;
      });
      fullStory += '\n';
    }
    
    segments.forEach((segment, index) => {
      fullStory += `${segment.text}\n\n`;
    });

    return {
      seeds: storySeeds.map(seed => ({
        playerName: seed.playerName,
        content: seed.content,
        wordCount: Utils.countWords(seed.content),
        timestamp: seed.timestamp
      })),
      segments: segments.map(segment => ({
        segmentNumber: segment.segmentNumber,
        text: segment.text,
        wordCount: Utils.countWords(segment.text),
        timestamp: segment.timestamp,
        template: segment.template,
        isConclusion: segment.isConclusion || false
      })),
      fullStory: fullStory.trim()
    };
  }

  extractPlayerData(session) {
    return Array.from(session.players.values()).map(player => {
      const contributions = this.analyzePlayerContributions(session, player.id);
      
      return {
        id: player.id,
        name: player.name,
        isHost: player.isHost,
        joinedAt: player.joinedAt,
        ipAddress: player.ipAddress,
        contributions,
        goals: player.goals || []
      };
    });
  }

  analyzePlayerContributions(session, playerId) {
    const allInputs = [
      ...(session.pendingInputs.seeds || []),
      ...(session.pendingInputs.direct || []),
      ...(session.pendingInputs.influence || [])
    ].filter(input => input.playerId === playerId);

    const directInputs = allInputs.filter(input => input.type === 'direct');
    const influenceInputs = allInputs.filter(input => input.type === 'influence');
    const seedInputs = allInputs.filter(input => input.type === 'seed');

    const directWords = directInputs.reduce((sum, input) => sum + Utils.countWords(input.content), 0);
    const influenceWords = influenceInputs.reduce((sum, input) => sum + Utils.countWords(input.content), 0);
    const seedWords = seedInputs.reduce((sum, input) => sum + Utils.countWords(input.content), 0);

    const totalWords = directWords + influenceWords + seedWords;
    const totalInputs = allInputs.length;

    // Calculate most active period (rough approximation)
    const activePeriod = this.calculateActivePeriod(allInputs, session);
    
    // Extract contribution themes
    const allContributions = allInputs.map(input => input.content);
    const themes = Utils.extractThemes(allContributions);

    return {
      totalInputs,
      directInputs: directInputs.length,
      influenceInputs: influenceInputs.length,
      seedInputs: seedInputs.length,
      wordCounts: {
        direct: directWords,
        influence: influenceWords,
        seed: seedWords,
        total: totalWords
      },
      percentageOfTotalContent: 0, // Will be calculated in stats
      mostActivePeriod: activePeriod,
      themes,
      sampleContributions: this.getSampleContributions(allInputs, 3)
    };
  }

  calculateActivePeriod(playerInputs, session) {
    if (playerInputs.length === 0) return 'No contributions';
    
    const storyStartTime = session.storyState.storyStartTime;
    const storyDuration = session.storyState.completedAt && storyStartTime ?
      (session.storyState.completedAt - storyStartTime) / 1000 : 600; // Default 10 minutes

    // Simple approximation: divide story into thirds
    const thirdDuration = storyDuration / 3;
    
    const periods = ['early', 'middle', 'late'];
    const periodCounts = [0, 0, 0];

    playerInputs.forEach(input => {
      if (!storyStartTime || !input.timestamp) return;
      
      const inputTime = (input.timestamp - storyStartTime) / 1000;
      const periodIndex = Math.min(2, Math.floor(inputTime / thirdDuration));
      periodCounts[periodIndex]++;
    });

    const maxCount = Math.max(...periodCounts);
    const mostActivePeriodIndex = periodCounts.indexOf(maxCount);
    
    return `${periods[mostActivePeriodIndex]} story development`;
  }

  getSampleContributions(inputs, count = 3) {
    if (inputs.length === 0) return [];
    
    // Try to get diverse samples
    const samples = [];
    const stepSize = Math.max(1, Math.floor(inputs.length / count));
    
    for (let i = 0; i < Math.min(count, inputs.length); i++) {
      const index = i * stepSize;
      if (index < inputs.length) {
        samples.push({
          content: inputs[index].content,
          type: inputs[index].type || 'unknown',
          timestamp: inputs[index].timestamp
        });
      }
    }
    
    return samples;
  }

  calculateStoryStats(storyData, playerData) {
    const totalSegments = storyData.segments.length;
    const totalStoryWords = storyData.segments.reduce((sum, segment) => sum + segment.wordCount, 0);
    const totalSeedWords = storyData.seeds.reduce((sum, seed) => sum + seed.wordCount, 0);
    
    const totalPlayerWords = playerData.reduce((sum, player) => sum + player.contributions.wordCounts.total, 0);
    const totalPlayerInputs = playerData.reduce((sum, player) => sum + player.contributions.totalInputs, 0);
    
    // Calculate player contribution percentages
    playerData.forEach(player => {
      player.contributions.percentageOfTotalContent = totalPlayerWords > 0 ?
        Math.round((player.contributions.wordCounts.total / totalPlayerWords) * 100) : 0;
    });

    return {
      totalSegments,
      totalWords: totalStoryWords + totalSeedWords,
      aiGeneratedWords: totalStoryWords,
      playerContributedWords: totalSeedWords, // Seeds become part of story directly
      totalPlayerInputWords: totalPlayerWords,
      totalPlayerInputs,
      averageSegmentLength: totalSegments > 0 ? Math.round(totalStoryWords / totalSegments) : 0,
      averageInputLength: totalPlayerInputs > 0 ? Math.round(totalPlayerWords / totalPlayerInputs) : 0
    };
  }

  generateStoryTitle(session) {
    // Try to extract title from first seed or use session ID
    const seeds = session.pendingInputs.seeds || [];
    
    if (seeds.length > 0) {
      const firstSeed = seeds[0].content;
      // Extract potential title from first few words
      const words = firstSeed.split(/\s+/).slice(0, 6);
      let title = words.join(' ');
      
      // Clean up title
      title = title.replace(/[^\w\s-]/g, '').trim();
      if (title.length > 30) {
        title = title.substring(0, 30).trim();
      }
      
      // Capitalize first letters
      title = title.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      
      return title || session.sessionId;
    }
    
    return session.sessionId;
  }

  generateMarkdown(exportData) {
    const md = [];
    const info = exportData.sessionInfo;
    const story = exportData.storyData;
    
    // Title and basic info
    md.push(`# ${info.storyTitle}`);
    md.push(`*A collaborative story by ${exportData.players.map(p => p.name).join(', ')}*`);
    md.push('');
    
    // Session information
    md.push('## Session Information');
    md.push(`- **Session ID**: ${info.sessionId}`);
    if (info.hostPlayer) {
      md.push(`- **Story Initiator**: ${info.hostPlayer.name}`);
    }
    md.push(`- **Duration**: ${Utils.formatTime(info.duration * 1000)} (${info.duration} seconds)`);
    md.push(`- **Story Duration**: ${Utils.formatTime(info.storyDuration * 1000)} (${info.storyDuration} seconds)`);
    md.push(`- **Players**: ${exportData.players.length} total`);
    md.push(`- **Competition Mode**: ${info.competitionMode ? 'Enabled' : 'Disabled'}`);
    md.push(`- **Generated**: ${exportData.generatedAt.toLocaleDateString()} at ${exportData.generatedAt.toLocaleTimeString()}`);
    md.push(`- **AI Model**: ${info.serverConfig.aiProvider}/${info.serverConfig.aiModel} (temp: ${info.serverConfig.temperature})`);
    md.push('');

    // Competition results (if enabled)
    if (exportData.competition.enabled && exportData.competition.results) {
      md.push('## Competition Results');
      md.push('');
      
      exportData.competition.results.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
        md.push(`${medal} **${index + 1}. ${player.playerName}**: ${player.totalScore}/${player.maxPossibleScore} points`);
      });
      md.push('');
    }

    // Story foundation
    if (story.seeds.length > 0) {
      md.push('## Initial Story Seeds');
      md.push('*Player-created story foundation*');
      md.push('');
      
      story.seeds.forEach(seed => {
        md.push(`**${seed.playerName}**: "${seed.content}" *(${seed.wordCount} words)*`);
      });
      md.push('');
    }

    // The story itself
    md.push('## The Story');
    md.push('*Generated through real-time AI and player collaboration*');
    md.push('');
    md.push(story.fullStory);
    md.push('');
    md.push('---');
    md.push('');

    // Player contributions
    md.push('## Player Contributions');
    md.push('');
    
    exportData.players.forEach(player => {
      const contrib = player.contributions;
      md.push(`### ${player.name}${player.isHost ? ' (Host)' : ''}`);
      md.push(`- **Total Inputs**: ${contrib.totalInputs}`);
      md.push(`- **Word Count**: ${contrib.wordCounts.total} words (${contrib.percentageOfTotalContent}% of all player input)`);
      md.push(`- **Direct Story**: ${contrib.directInputs} inputs, ${contrib.wordCounts.direct} words`);
      md.push(`- **Influences**: ${contrib.influenceInputs} inputs, ${contrib.wordCounts.influence} words`);
      md.push(`- **Seeds**: ${contrib.seedInputs} inputs, ${contrib.wordCounts.seed} words`);
      md.push(`- **Most Active Period**: ${contrib.mostActivePeriod}`);
      if (contrib.themes.length > 0) {
        md.push(`- **Contribution Themes**: ${contrib.themes.join(', ')}`);
      }
      md.push('');
    });

    // Competition goals (if enabled)
    if (exportData.competition.enabled && exportData.competition.playerScores) {
      md.push('## Competition Goals and Scores');
      md.push('');
      
      Object.values(exportData.competition.playerScores).forEach(playerScore => {
        md.push(`### ${playerScore.playerName} - ${playerScore.totalScore}/${playerScore.maxPossibleScore} points`);
        md.push('');
        
        playerScore.goals.forEach((goal, index) => {
          const status = goal.score === 3 ? '✅' : goal.score === 2 ? '⚠️' : '❌';
          const scoreText = goal.score === 3 ? 'Perfect' : goal.score === 2 ? 'Partial' : 'Not achieved';
          
          md.push(`**Goal ${index + 1} (${goal.score}/3 - ${scoreText})**: ${status} "${goal.text}"`);
          if (goal.evaluation) {
            md.push(`*Evaluation: ${goal.evaluation}*`);
          }
          md.push('');
        });
      });
    }

    // Story statistics
    md.push('## Story Statistics');
    md.push('');
    md.push(`- **Total Story Length**: ${exportData.storyStats.totalWords} words`);
    md.push(`- **AI Generated**: ${exportData.storyStats.aiGeneratedWords} words (${Math.round(exportData.storyStats.aiGeneratedWords / exportData.storyStats.totalWords * 100)}%)`);
    md.push(`- **Player Seeds**: ${exportData.storyStats.playerContributedWords} words (${Math.round(exportData.storyStats.playerContributedWords / exportData.storyStats.totalWords * 100)}%)`);
    md.push(`- **Story Segments**: ${exportData.storyStats.totalSegments}`);
    md.push(`- **Average Segment Length**: ${exportData.storyStats.averageSegmentLength} words`);
    md.push(`- **Total Player Inputs**: ${exportData.storyStats.totalPlayerInputs} (${exportData.storyStats.totalPlayerInputWords} words)`);
    md.push(`- **Average Input Length**: ${exportData.storyStats.averageInputLength} words`);
    md.push('');

    // Footer
    md.push('---');
    md.push('');
    md.push('*Generated by Story Chef - Collaborative AI Storytelling*');

    return md.join('\n');
  }

  async saveMarkdownFile(sessionId, markdown) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `${sessionId}_${timestamp}.md`;
    const filePath = path.join(this.exportsDir, filename);
    
    await fs.promises.writeFile(filePath, markdown, 'utf8');
    return filePath;
  }

  // Quick export without full processing (for basic exports)
  async quickExport(session, competitionResults = null) {
    const sessionId = session.sessionId;
    
    try {
      const basicData = {
        sessionId,
        createdAt: session.createdAt,
        players: Array.from(session.players.values()).map(p => p.name),
        segments: session.storyState.segments || [],
        seeds: session.pendingInputs.seeds || [],
        competitionMode: session.competitionMode || false
      };

      // Simple markdown
      const md = [];
      md.push(`# ${sessionId}`);
      md.push(`*Players: ${basicData.players.join(', ')}*`);
      md.push('');
      
      // Seeds
      if (basicData.seeds.length > 0) {
        md.push('## Story Seeds');
        basicData.seeds.forEach(seed => {
          md.push(`**${seed.playerName}**: ${seed.content}`);
        });
        md.push('');
      }
      
      // Story
      md.push('## Story');
      basicData.segments.forEach(segment => {
        md.push(segment.text);
        md.push('');
      });

      const markdown = md.join('\n');
      const filePath = await this.saveMarkdownFile(sessionId, markdown);
      
      return {
        success: true,
        filePath,
        exportType: 'quick'
      };
      
    } catch (error) {
      this.logger.error(`Quick export failed: ${error.message}`, sessionId);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ExportEngine;