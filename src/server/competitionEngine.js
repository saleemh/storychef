const EventEmitter = require('events');
const Utils = require('../shared/utils');

class CompetitionEngine extends EventEmitter {
  constructor(config, liteLLMBridge, logger) {
    super();
    this.config = config;
    this.ai = liteLLMBridge;
    this.logger = logger;
    
    // Active competitions map: sessionId -> competition state
    this.activeCompetitions = new Map();
  }

  async initializeCompetition(sessionId, sessionManager) {
    if (!this.config.competition.enabled) {
      return { success: false, message: 'Competition mode disabled' };
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, message: 'Session not found' };
    }

    this.logger.info('Initializing competition mode', sessionId);

    const competition = {
      sessionId,
      sessionManager,
      playerGoals: new Map(), // playerId -> goals array
      playerScores: new Map(), // playerId -> score data
      difficulty: this.config.competition.difficulty,
      goalsPerPlayer: this.config.competition.goalsPerPlayer,
      isInitialized: false,
      isCompleted: false,
      completedAt: null
    };

    this.activeCompetitions.set(sessionId, competition);

    try {
      // Generate goals for all current players
      await this.generateGoalsForAllPlayers(sessionId);
      competition.isInitialized = true;
      
      this.logger.info('Competition initialized successfully', sessionId);
      this.emit('competition_initialized', { sessionId, playerCount: session.players.size });
      
      return { success: true, competition };
      
    } catch (error) {
      this.logger.error(`Failed to initialize competition: ${error.message}`, sessionId);
      this.activeCompetitions.delete(sessionId);
      return { success: false, message: error.message };
    }
  }

  async generateGoalsForAllPlayers(sessionId) {
    const competition = this.activeCompetitions.get(sessionId);
    if (!competition) {
      throw new Error('Competition not found');
    }

    const session = competition.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const players = Array.from(session.players.values());
    this.logger.info(`Generating goals for ${players.length} players`, sessionId);

    for (const player of players) {
      try {
        const goals = await this.generateGoalsForPlayer(
          player.id, 
          competition.difficulty,
          competition.goalsPerPlayer
        );
        
        competition.playerGoals.set(player.id, goals);
        
        // Add goals to session player data
        const sessionPlayer = session.players.get(player.id);
        if (sessionPlayer) {
          sessionPlayer.goals = goals;
        }
        
        this.logger.debug(`Generated ${goals.length} goals for player ${player.name}`, sessionId);
        
      } catch (error) {
        this.logger.error(`Failed to generate goals for player ${player.name}: ${error.message}`, sessionId);
        
        // Generate fallback goals
        const fallbackGoals = this.generateFallbackGoals(player.id, competition.goalsPerPlayer);
        competition.playerGoals.set(player.id, fallbackGoals);
        
        const sessionPlayer = session.players.get(player.id);
        if (sessionPlayer) {
          sessionPlayer.goals = fallbackGoals;
        }
      }
    }
  }

  async generateGoalsForPlayer(playerId, difficulty = 'medium', goalsCount = 5) {
    const variables = {
      model_provider: this.config.aiModel.provider,
      model_name: this.config.aiModel.model,
      goals_count: goalsCount,
      difficulty: difficulty
    };

    const result = await this.ai.executeTemplate('competition_goal_generation', variables);
    
    if (!result.success) {
      throw new Error(result.error || 'Goal generation failed');
    }

    const goalTexts = Utils.parseGoals(result.content);
    
    if (goalTexts.length < goalsCount) {
      this.logger.warn(`Only generated ${goalTexts.length}/${goalsCount} goals for player ${playerId}`);
    }

    return goalTexts.slice(0, goalsCount).map((goalText, index) => ({
      id: `${playerId}_goal_${index + 1}`,
      text: goalText,
      playerId: playerId,
      achieved: false,
      score: 0,
      evaluation: null
    }));
  }

  generateFallbackGoals(playerId, goalsCount = 5) {
    const fallbackGoals = [
      "A character discovers something unexpected in an old container",
      "Someone mentions a specific number that becomes important to the plot", 
      "A mysterious stranger appears at a crucial moment",
      "Weather conditions affect the story's outcome",
      "A character makes a difficult choice between two options",
      "An object gets lost and then found again",
      "Someone receives unexpected news",
      "A character remembers something important from their past",
      "Two characters have a meaningful conversation",
      "The setting changes to a completely different location"
    ];

    return fallbackGoals.slice(0, goalsCount).map((goalText, index) => ({
      id: `${playerId}_goal_${index + 1}`,
      text: goalText,
      playerId: playerId,
      achieved: false,
      score: 0,
      evaluation: `Fallback goal generated due to AI error`,
      isFallback: true
    }));
  }

  async addPlayerToCompetition(sessionId, playerId) {
    const competition = this.activeCompetitions.get(sessionId);
    if (!competition || !competition.isInitialized) {
      return { success: false, message: 'Competition not initialized' };
    }

    const session = competition.sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, message: 'Session not found' };
    }

    const player = session.players.get(playerId);
    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    // Don't regenerate if player already has goals
    if (competition.playerGoals.has(playerId)) {
      return { success: true, goals: competition.playerGoals.get(playerId) };
    }

    this.logger.info(`Adding player ${player.name} to competition`, sessionId);

    try {
      const goals = await this.generateGoalsForPlayer(
        playerId,
        competition.difficulty,
        competition.goalsPerPlayer
      );

      competition.playerGoals.set(playerId, goals);
      player.goals = goals;

      this.emit('player_goals_generated', { sessionId, playerId, goals });
      return { success: true, goals };
      
    } catch (error) {
      this.logger.error(`Failed to generate goals for new player: ${error.message}`, sessionId);
      
      const fallbackGoals = this.generateFallbackGoals(playerId, competition.goalsPerPlayer);
      competition.playerGoals.set(playerId, fallbackGoals);
      player.goals = fallbackGoals;
      
      return { success: true, goals: fallbackGoals, fallback: true };
    }
  }

  async scoreCompetition(sessionId) {
    const competition = this.activeCompetitions.get(sessionId);
    if (!competition) {
      return { success: false, message: 'Competition not found' };
    }

    const session = competition.sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, message: 'Session not found' };
    }

    this.logger.info('Starting competition scoring', sessionId);
    
    // Build full story text
    const fullStory = this.buildFullStoryText(session);
    
    const playerScores = new Map();
    
    // Score goals for each player
    for (const [playerId, goals] of competition.playerGoals) {
      const player = session.players.get(playerId);
      if (!player) continue;

      this.logger.debug(`Scoring goals for player ${player.name}`, sessionId);
      
      try {
        const scoredGoals = await this.scorePlayerGoals(goals, fullStory);
        const totalScore = scoredGoals.reduce((sum, goal) => sum + goal.score, 0);
        const maxPossibleScore = goals.length * 3;
        
        const playerScoreData = {
          playerId,
          playerName: player.name,
          goals: scoredGoals,
          totalScore,
          maxPossibleScore,
          achievedGoals: scoredGoals.filter(g => g.score > 1).length,
          perfectGoals: scoredGoals.filter(g => g.score === 3).length
        };
        
        playerScores.set(playerId, playerScoreData);
        this.logger.info(`Player ${player.name} scored ${totalScore}/${maxPossibleScore}`, sessionId);
        
      } catch (error) {
        this.logger.error(`Failed to score goals for player ${player.name}: ${error.message}`, sessionId);
        
        // Create fallback score
        const fallbackScore = {
          playerId,
          playerName: player.name,
          goals: goals.map(goal => ({ ...goal, score: 1, evaluation: 'Scoring failed' })),
          totalScore: goals.length, // Minimum score
          maxPossibleScore: goals.length * 3,
          achievedGoals: 0,
          perfectGoals: 0,
          scoringError: true
        };
        
        playerScores.set(playerId, fallbackScore);
      }
    }
    
    // Create leaderboard
    const leaderboard = Array.from(playerScores.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((playerScore, index) => ({
        ...playerScore,
        rank: index + 1,
        percentile: Math.round(((playerScores.size - index) / playerScores.size) * 100)
      }));
    
    // Store results
    competition.playerScores = playerScores;
    competition.leaderboard = leaderboard;
    competition.isCompleted = true;
    competition.completedAt = new Date();
    
    this.logger.info(`Competition scoring completed. Winner: ${leaderboard[0]?.playerName} (${leaderboard[0]?.totalScore} points)`, sessionId);
    
    this.emit('competition_scored', { 
      sessionId, 
      leaderboard, 
      totalPlayers: playerScores.size 
    });
    
    return {
      success: true,
      leaderboard,
      playerScores: Object.fromEntries(playerScores),
      fullStory
    };
  }

  async scorePlayerGoals(goals, fullStory) {
    const scoredGoals = [];
    
    for (const goal of goals) {
      try {
        const variables = {
          model_provider: this.config.aiModel.provider,
          model_name: this.config.aiModel.model,
          full_story: fullStory,
          goal_statement: goal.text
        };
        
        const result = await this.ai.executeTemplate('competition_goal_scoring', variables);
        
        if (!result.success) {
          throw new Error(result.error || 'Goal scoring failed');
        }
        
        const scoreMatch = result.content.match(/Score[:\s]*([123])/i);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 1;
        
        // Ensure score is valid
        const validScore = Math.max(1, Math.min(3, score));
        
        scoredGoals.push({
          ...goal,
          score: validScore,
          evaluation: result.content.trim(),
          achieved: validScore > 1
        });
        
      } catch (error) {
        this.logger.error(`Failed to score individual goal: ${error.message}`);
        
        // Fallback scoring
        scoredGoals.push({
          ...goal,
          score: 1,
          evaluation: `Scoring failed: ${error.message}`,
          achieved: false
        });
      }
    }
    
    return scoredGoals;
  }

  buildFullStoryText(session) {
    let storyText = '';
    
    // Add story seeds
    if (session.pendingInputs.seeds.length > 0) {
      storyText += 'Story Foundation:\n';
      session.pendingInputs.seeds.forEach(seed => {
        storyText += `${seed.content}\n`;
      });
      storyText += '\n';
    }
    
    // Add all story segments
    if (session.storyState.segments.length > 0) {
      storyText += 'Story:\n';
      session.storyState.segments.forEach(segment => {
        storyText += `${segment.text}\n\n`;
      });
    }
    
    return storyText.trim();
  }

  getPlayerGoals(sessionId, playerId) {
    const competition = this.activeCompetitions.get(sessionId);
    if (!competition) {
      return null;
    }
    
    return competition.playerGoals.get(playerId) || null;
  }

  getCompetitionResults(sessionId) {
    const competition = this.activeCompetitions.get(sessionId);
    if (!competition || !competition.isCompleted) {
      return null;
    }
    
    return {
      leaderboard: competition.leaderboard,
      playerScores: Object.fromEntries(competition.playerScores),
      completedAt: competition.completedAt,
      totalPlayers: competition.playerScores.size
    };
  }

  isCompetitionEnabled(sessionId) {
    return this.activeCompetitions.has(sessionId);
  }

  isCompetitionInitialized(sessionId) {
    const competition = this.activeCompetitions.get(sessionId);
    return competition?.isInitialized || false;
  }

  isCompetitionCompleted(sessionId) {
    const competition = this.activeCompetitions.get(sessionId);
    return competition?.isCompleted || false;
  }

  stopCompetition(sessionId) {
    const competition = this.activeCompetitions.get(sessionId);
    if (!competition) {
      return false;
    }

    this.logger.info('Stopping competition', sessionId);
    this.activeCompetitions.delete(sessionId);
    this.emit('competition_stopped', { sessionId });
    
    return true;
  }

  getCompetitionStats() {
    const activeCount = Array.from(this.activeCompetitions.values())
      .filter(c => c.isInitialized && !c.isCompleted).length;
    
    const completedCount = Array.from(this.activeCompetitions.values())
      .filter(c => c.isCompleted).length;
    
    return {
      totalCompetitions: this.activeCompetitions.size,
      activeCompetitions: activeCount,
      completedCompetitions: completedCount
    };
  }

  shutdown() {
    this.logger.info(`Shutting down competition engine (${this.activeCompetitions.size} active competitions)`);
    
    for (const sessionId of this.activeCompetitions.keys()) {
      this.stopCompetition(sessionId);
    }
    
    this.activeCompetitions.clear();
  }
}

module.exports = CompetitionEngine;