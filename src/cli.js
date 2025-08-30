#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const { program } = require('commander');
const path = require('path');
const StoryChefServer = require('./server/server');
const StoryChefClient = require('./client/client');
const TerminalUI = require('./client/ui/terminalUI');
const InputProcessor = require('./client/inputProcessor');
const ConfigManager = require('./shared/config');

// Set up the CLI program
program
  .name('story-chef')
  .description('StoryChef - Collaborative AI Storytelling')
  .version('1.0.0');

// Server command
program
  .command('server')
  .description('Start the Story Chef server')
  .option('-c, --config <path>', 'Configuration file path', './story-chef.config.json')
  .option('-p, --port <number>', 'Server port', (val) => parseInt(val), 3333)
  .option('--web', 'Enable web terminal interface')
  .option('--log-level <level>', 'Log level (error, warn, info, debug)')
  .action(async (options) => {
    try {
      console.log('🌟 Starting Story Chef Server...');
      
      // Load configuration
      const config = new ConfigManager(options.config);
      
      // Override config with CLI options
      if (options.port) {
        config.set('server.port', options.port);
      }
      
      if (options.web) {
        config.set('webFrontend.enabled', true);
      }
      
      if (options.logLevel) {
        config.set('server.logLevel', options.logLevel);
      }
      
      // Create and start server
      const server = new StoryChefServer(options.config);
      
      await server.start();
      
      // Handle graceful shutdown
      const shutdown = async () => {
        console.log('\n🛑 Shutting down server...');
        await server.stop();
        process.exit(0);
      };
      
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      
    } catch (error) {
      console.error('❌ Failed to start server:', error.message);
      process.exit(1);
    }
  });

// Start client command  
program
  .command('start')
  .description('Start Story Chef client and connect to server')
  .option('-s, --server <url>', 'Server URL', 'ws://localhost:3333')
  .option('-n, --name <name>', 'Player name')
  .option('-j, --join <code>', 'Join existing session with code')
  .option('--auto-create', 'Automatically create a session instead of prompting')
  .action(async (options) => {
    try {
      console.log('🌟 Starting Story Chef Client...');
      console.log(`Connecting to server: ${options.server}`);
      
      // Create client and UI
      const client = new StoryChefClient(options.server);
      const terminalUI = new TerminalUI(client);
      const inputProcessor = new InputProcessor(client);
      
      // Connect to server
      await client.connect();
      
      // Display welcome message
      terminalUI.displayWelcome();
      
      // Handle session creation/joining
      if (options.join) {
        // Join existing session
        const playerName = options.name || await promptForName();
        await client.joinSession(options.join, playerName);
        
      } else if (options.autoCreate) {
        // Auto-create session
        const playerName = options.name || `Player_${Math.floor(Math.random() * 1000)}`;
        await client.createSession(playerName);
        
      } else {
        // Interactive mode - will be handled by UI
        terminalUI.showMessage('Use create-session or join-session commands, or press ? for help');
      }
      
      // Focus input for user interaction
      terminalUI.focusInput();
      
    } catch (error) {
      console.error('❌ Failed to start client:', error.message);
      process.exit(1);
    }
  });

// Create session command
program
  .command('create')
  .description('Create a new story session')
  .option('-s, --server <url>', 'Server URL', 'ws://localhost:3333')
  .option('-n, --name <name>', 'Player name')
  .action(async (options) => {
    try {
      const client = new StoryChefClient(options.server);
      const terminalUI = new TerminalUI(client);
      
      await client.connect();
      
      const playerName = options.name || await promptForName();
      const result = await client.createSession(playerName);
      
      // Send messages through terminal UI instead of console.log to avoid interference
      terminalUI.displayWelcome();
      terminalUI.showMessage(`✅ Session created: ${result.sessionId}`, 'green');
      terminalUI.showMessage(`🎮 You are the host of this session`, 'cyan');
      terminalUI.showMessage(`📢 Share this code with other players: ${result.sessionId}`, 'yellow');
      terminalUI.showMessage(`🌐 Or share this URL: http://localhost:3001/join/${result.sessionId}`, 'blue');
      terminalUI.focusInput();
      
    } catch (error) {
      console.error('❌ Failed to create session:', error.message);
      process.exit(1);
    }
  });

// Join session command
program
  .command('join <sessionCode>')
  .description('Join an existing story session')
  .option('-s, --server <url>', 'Server URL', 'ws://localhost:3333')
  .option('-n, --name <name>', 'Player name')
  .action(async (sessionCode, options) => {
    try {
      const client = new StoryChefClient(options.server);
      const terminalUI = new TerminalUI(client);
      
      await client.connect();
      
      const playerName = options.name || await promptForName();
      await client.joinSession(sessionCode, playerName);
      
      // Send message through terminal UI instead of console.log
      terminalUI.showMessage(`✅ Joined session: ${sessionCode}`, 'green');
      
      terminalUI.displayWelcome();
      terminalUI.focusInput();
      
    } catch (error) {
      console.error('❌ Failed to join session:', error.message);
      process.exit(1);
    }
  });

// Test connection command
program
  .command('test')
  .description('Test connection to Story Chef server')
  .option('-s, --server <url>', 'Server URL', 'ws://localhost:3333')
  .action(async (options) => {
    try {
      console.log(`🔍 Testing connection to ${options.server}...`);
      
      const client = new StoryChefClient(options.server);
      
      await client.connect();
      console.log('✅ Connection successful!');
      
      client.disconnect();
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Show current configuration')
  .option('-c, --config <path>', 'Configuration file path', './story-chef.config.json')
  .action((options) => {
    try {
      const config = new ConfigManager(options.config);
      const currentConfig = config.getConfig();
      
      console.log('📋 Story Chef Configuration:');
      console.log('');
      console.log(`AI Model: ${currentConfig.aiModel.provider}/${currentConfig.aiModel.model}`);
      console.log(`Temperature: ${currentConfig.aiModel.temperature}`);
      console.log(`Max Tokens: ${currentConfig.aiModel.maxTokens}`);
      console.log('');
      console.log(`Server Port: ${currentConfig.server.port}`);
      console.log(`Max Players: ${currentConfig.server.maxPlayers}`);
      console.log(`Max Sessions: ${currentConfig.server.maxConcurrentSessions}`);
      console.log(`Log Level: ${currentConfig.server.logLevel}`);
      console.log('');
      console.log(`Story Duration: ${currentConfig.storyPacing.storyTimeLimit / 60000} minutes`);
      console.log(`Segment Delay: ${currentConfig.storyPacing.segmentDelay / 1000} seconds`);
      console.log(`Seeding Time: ${currentConfig.storyPacing.seedingTime / 1000} seconds`);
      console.log('');
      console.log(`Competition Mode: ${currentConfig.competition.enabled ? 'Enabled' : 'Disabled'}`);
      if (currentConfig.competition.enabled) {
        console.log(`Goals Per Player: ${currentConfig.competition.goalsPerPlayer}`);
        console.log(`Difficulty: ${currentConfig.competition.difficulty}`);
      }
      console.log('');
      console.log(`Web Frontend: ${currentConfig.webFrontend.enabled ? 'Enabled' : 'Disabled'}`);
      if (currentConfig.webFrontend.enabled) {
        console.log(`Web Port: ${currentConfig.webFrontend.port}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to load configuration:', error.message);
      process.exit(1);
    }
  });

// Version info with dependencies
program
  .command('info')
  .description('Show Story Chef version and dependency information')
  .action(() => {
    console.log('📦 Story Chef - Collaborative AI Storytelling');
    console.log(`Version: 1.0.0`);
    console.log('');
    console.log('🔧 Core Dependencies:');
    console.log('- Node.js Socket.io for real-time communication');
    console.log('- LiteLLM for universal AI model access');
    console.log('- PDL (Prompt Declaration Language) for prompt management');
    console.log('- Blessed.js for terminal UI');
    console.log('- Commander.js for CLI interface');
    console.log('');
    console.log('🎯 Key Features:');
    console.log('- Real-time collaborative storytelling');
    console.log('- Dual input modes (Direct/Influence)');
    console.log('- Competition mode with secret goals');
    console.log('- Multi-session server support');
    console.log('- Comprehensive story export system');
    console.log('- Web terminal interface');
    console.log('');
    console.log('📚 Documentation: https://github.com/story-chef/story-chef');
    console.log('🐛 Issues: https://github.com/story-chef/story-chef/issues');
  });

// Utility function to prompt for player name
async function promptForName() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('👤 Enter your player name: ', (answer) => {
      rl.close();
      resolve(answer.trim() || `Player_${Math.floor(Math.random() * 1000)}`);
    });
  });
}

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}