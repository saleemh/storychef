# StoryChef Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
# Node.js dependencies
npm install

# Python dependencies (requires Python 3.8+)
pip install -r requirements.txt
```

### 2. Configure API Keys

Create a `.env` file in the project root with your AI provider API keys:

```bash
# For OpenAI (recommended for testing)
export OPENAI_API_KEY="sk-your-openai-api-key-here"

# For Anthropic Claude (alternative)
export ANTHROPIC_API_KEY="sk-ant-your-anthropic-key-here"

# For local models (optional)
export OLLAMA_HOST="http://localhost:11434"
```

**Load environment variables:**
```bash
source .env
```

### 3. Test the Setup

```bash
# Test basic functionality
node src/cli.js info

# Test AI bridge connection
node src/cli.js test
```

### 4. Start StoryChef

**Terminal 1 - Start Server:**
```bash
node src/cli.js server
```

**Terminal 2 - Start Client:**
```bash
node src/cli.js start
```

## Configuration Options

### Basic Configuration (`story-chef.config.json`)

```json
{
  "aiModel": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.8,
    "maxTokens": 300
  },
  "competition": {
    "enabled": false
  }
}
```

### AI Provider Options

**OpenAI (Recommended):**
```json
{
  "provider": "openai",
  "model": "gpt-4o-mini"
}
```

**Anthropic Claude:**
```json
{
  "provider": "anthropic", 
  "model": "claude-3-haiku-20240307"
}
```

**Local Ollama:**
```json
{
  "provider": "ollama",
  "model": "llama3"
}
```

## Testing Checklist

### ✅ Basic Functionality Tests

1. **Server starts successfully:**
   ```bash
   node src/cli.js server
   # Should show: "✅ Server running on port 3000"
   ```

2. **Client connects to server:**
   ```bash
   node src/cli.js test
   # Should show: "✅ Connection successful!"
   ```

3. **Create and join sessions:**
   ```bash
   # Terminal 1: Create session
   node src/cli.js create --name "TestPlayer1"
   
   # Terminal 2: Join with the session code from Terminal 1
   node src/cli.js join MAGIC-FOREST-7429 --name "TestPlayer2"
   ```

### ✅ Story Generation Tests

1. **Story seeding works (30 seconds)**
2. **AI generates story segments every 30 seconds**
3. **Both Direct and Influence modes work (Tab to switch)**
4. **Story exports to markdown after completion**

### ✅ Competition Mode Tests

1. **Enable competition mode:**
   ```json
   {
     "competition": {
       "enabled": true,
       "goalsPerPlayer": 3,
       "difficulty": "easy"
     }
   }
   ```

2. **Verify secret goals are generated (Press G during game)**
3. **Verify scoring works after story completion**

## Troubleshooting

### Common Issues

**1. "AI generation failed"**
- Check your API keys are set correctly
- Verify you have credits/quota with your AI provider
- Try switching to a different model (gpt-4o-mini is cheapest)

**2. "Python process failed"**
- Ensure Python 3.8+ is installed: `python3 --version`
- Install dependencies: `pip install litellm prompt-declaration-language PyYAML`
- Check if `python3` command works: `which python3`

**3. "Connection failed"**
- Ensure server is running first
- Check port 3000 is not in use: `lsof -i :3000`
- Try different port: `node src/cli.js server --port 3001`

**4. "Module not found"**
- Run `npm install` to install Node.js dependencies
- Check if you're in the correct directory

### Debug Mode

```bash
# Run server with debug logging
node src/cli.js server --log-level debug

# Test specific components
node -e "const config = require('./src/shared/config'); console.log(new config().getConfig())"
```

## Next Steps

Once basic testing works:

1. **Test multiplayer** - Open multiple terminals and join same session
2. **Test competition mode** - Enable and verify goal generation
3. **Export stories** - Check `exports/` directory for markdown files
4. **Deploy to server** - See DEPLOYMENT.md for production setup

## API Cost Management

**Recommended for testing:**
- **OpenAI gpt-4o-mini**: ~$0.0001 per story segment (very cheap)
- **Anthropic Claude Haiku**: ~$0.0003 per story segment
- **Local Ollama**: Free (but requires local setup)

**Cost per 10-minute story:** ~$0.002-0.006 for 20 segments