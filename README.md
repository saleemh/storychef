# StoryChef 🌟

**Collaborative AI Storytelling with Competitive Gaming Elements**

StoryChef is a real-time multiplayer storytelling platform where players collaborate with AI to create engaging stories. Features dual input modes, competition system with secret goals, and comprehensive analytics.

## ✨ Key Features

- **🤝 Real-time Collaboration**: Up to 100 players per story session
- **🤖 Universal AI Support**: OpenAI, Anthropic, Ollama, and 100+ models via LiteLLM  
- **✍️ Dual Input Modes**: Direct story writing vs. influence suggestions
- **🏆 Competition Mode**: Secret AI-generated goals with intelligent scoring
- **⏱️ Time-Managed Stories**: 10-minute stories with 30-second AI segments
- **📊 Rich Analytics**: Detailed player contribution analysis and exports
- **🖥️ Terminal & Web UI**: Native terminal experience plus web interface

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Clone repository
git clone https://github.com/saleemh/storychef.git
cd storychef

# Install Node.js dependencies
npm install

# Install Python dependencies  
pip install -r requirements.txt
```

### 2. Configure AI Provider

```bash
# Copy environment template
cp .env.example .env

# Add your API key (choose one):
echo "OPENAI_API_KEY=sk-your-key-here" >> .env
# OR
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env

# Load environment
source .env
```

### 3. Test & Run

```bash
# Test setup
node src/cli.js test

# Start server (Terminal 1)
node src/cli.js server

# Start client (Terminal 2)  
node src/cli.js start
```

## 🎮 How to Play

### Creating Stories

1. **Seed Phase** (30 seconds): Players create the story foundation
2. **Story Phase** (10 minutes): AI generates segments every 30 seconds
3. **Input Modes**: 
   - **Direct Mode**: Write exact text for the story
   - **Influence Mode**: Suggest themes and directions
4. **Competition** (optional): Achieve secret goals for points

### Commands

```bash
# Server management
node src/cli.js server                    # Start server
node src/cli.js server --port 3001        # Custom port
node src/cli.js server --web              # Enable web interface

# Client commands
node src/cli.js start                     # Interactive client
node src/cli.js create --name "YourName"  # Create session
node src/cli.js join GAME-CODE            # Join session
node src/cli.js test                      # Test connection

# Utilities
node src/cli.js config                    # Show configuration
node src/cli.js info                      # Version info
```

## ⚙️ Configuration

Edit `story-chef.config.json`:

```json
{
  "aiModel": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.8,
    "maxTokens": 300
  },
  "competition": {
    "enabled": true,
    "difficulty": "medium",
    "goalsPerPlayer": 5
  },
  "server": {
    "port": 3000,
    "maxPlayers": 100,
    "maxConcurrentSessions": 50
  }
}
```

## 🏗️ Architecture

**Phase 1: Core Foundation** ✅ Complete
- Client-server architecture with Socket.io
- LiteLLM + PDL bridge for AI integration  
- Story engine with continuous generation
- Competition system with goal generation and scoring
- Terminal UI with Blessed.js
- Export system with comprehensive analytics

**Upcoming Phases:**
- **Phase 2**: Enhanced multiplayer with live input views
- **Phase 3**: Performance optimization and scaling  
- **Phase 4**: Web terminal frontend with xterm.js
- **Phase 5**: Advanced analytics and global leaderboards

## 🔧 Development

### Project Structure

```
storychef/
├── src/
│   ├── cli.js                    # Main CLI entry point
│   ├── server/                   # Server implementation
│   │   ├── server.js            # Socket.io server
│   │   ├── storyEngine.js       # AI story generation
│   │   ├── competitionEngine.js # Goal generation & scoring
│   │   └── sessionManager.js    # Session state management
│   ├── client/                   # Client implementation
│   │   ├── client.js            # Socket.io client
│   │   ├── inputProcessor.js    # Dual input modes
│   │   └── ui/terminalUI.js     # Blessed.js interface
│   └── shared/                   # Shared utilities
├── prompts/story-prompts.pdl     # AI prompt templates
└── story-chef.config.json       # Main configuration
```

### Testing

```bash
# Unit tests
npm test

# Integration tests  
npm run test:integration

# Load testing
npm run test:load
```

## 🚀 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment guides:

- **VPS/Cloud deployment** with PM2 and Nginx
- **Docker deployment** with compose
- **Security configuration** and monitoring
- **Scaling strategies** for high-traffic scenarios

## 📖 Documentation

- **[Setup Guide](SETUP.md)**: Detailed installation and testing
- **[Deployment Guide](DEPLOYMENT.md)**: Production deployment
- **[Planning Document](planning.md)**: Complete technical specification
- **[TODO](TODO.md)**: Implementation progress and roadmap

## 💡 AI Provider Options

### OpenAI (Recommended)
- **gpt-4o-mini**: $0.0001 per story segment (~$0.002/story)
- **gpt-4o**: $0.003 per story segment (~$0.06/story)

### Anthropic Claude  
- **claude-3-haiku**: $0.0003 per story segment (~$0.006/story)
- **claude-3-5-sonnet**: $0.015 per story segment (~$0.30/story)

### Local/Free Options
- **Ollama**: Free local models (llama3, mistral, etc.)
- **Together.ai**: Various open-source models

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Follow the planning document specifications
4. Add tests for new functionality
5. Submit pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🎯 Example Session

```
🌟 Welcome to Story Chef! 🌟
Your game code: MAGIC-FOREST-7429

📝 SEED YOUR STORY 📝
💬 Type your story seed: In a magical academy where students learn to control elements...

[AI generates story segments every 30 seconds]
[Players use Direct mode to write story text]
[Players use Influence mode to guide story direction]
[Competition goals tracked secretly]

🎉 STORY COMPLETE! 🎉
🏆 Competition Results: Player1 (12 pts), Player2 (9 pts)
📄 Story exported to: exports/MAGIC-FOREST-7429_2024-12-19.md
```

---

Built with ❤️ by the StoryChef team using [Claude Code](https://claude.ai/code)