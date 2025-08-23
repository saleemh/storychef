# Story Chef - CLI Interactive Storytelling App Plan

## Core Concept
A command-line interactive storytelling app that generates stories continuously using AI models, 4-6 sentences at a time every 30 seconds. Users can inject custom instructions at any moment to influence the narrative in real-time. Stories have a 10-minute time limit with automatic conclusion. Supports robust multiplayer with seamless join/drop handling and post-story rating system.

## Technology Stack
- **Runtime**: Node.js CLI application
- **Networking**: Socket.io for real-time multiplayer with reconnection handling
- **Configuration**: JSON/YAML config files
- **AI Integration**: OpenAI API and/or Anthropic Claude API
- **File System**: Local file storage for prompts and generated stories
- **CLI Framework**: Commander.js for argument parsing
- **Terminal UI**: Blessed.js for multiple view management and real-time updates
- **Session Management**: Redis or in-memory store for persistent game sessions

## Configuration System (`story-chef.config.json`)
```json
{
  "ageRange": "6-8",
  "characters": {
    "protagonist": {
      "name": "Alex", 
      "traits": ["brave", "curious"],
      "appearance": "brown hair, green eyes"
    },
    "companion": {
      "name": "Luna",
      "traits": ["wise", "magical"],
      "type": "talking cat"
    }
  },
  "aiModel": {
    "provider": "openai|claude",
    "model": "gpt-4o|claude-3-5-sonnet",
    "apiKey": "sk-...",
    "maxTokens": 300
  },
  "storyPacing": {
    "initialDelay": 30000,
    "segmentDelay": 30000,
    "segmentLength": "4-6 sentences",
    "storyTimeLimit": 600000,
    "pauseOnInput": false
  },
  "storyLength": "medium",
  "promptsFolder": "./prompts/",
  "server": {
    "port": 3000,
    "maxPlayers": 100,
    "allowLateJoins": true,
    "reconnectTimeout": 60000
  }
}
```

## Enhanced Features

### 1. Game Initialization with Configurable Initial Delay
```
$ story-chef start

🌟 Welcome to Story Chef! 🌟
Your game code: MAGIC-FOREST-7429

[Theme selection and player setup...]

✨ Generating your magical story world...

═══════════════════════════════════════════════════════════════
🎮 GAME RULES - THORNWICK ACADEMY
═══════════════════════════════════════════════════════════════
👥 Players: 3 (SaleemTheGreat, MagicFan2024, WizardMaster99)
⏰ Story Duration: 10 minutes total
📖 New story segment every 30 seconds
💭 Type influences anytime - they shape the next segment
🔄 Press Shift+Tab to cycle between Story/Live Input/Chat views
═══════════════════════════════════════════════════════════════

📚 WELCOME TO THORNWICK ACADEMY 📚

You are Alex, a new student arriving at Thornwick Academy of Magical Arts. The ancient stone castle rises before you, its towers twisted with glowing vines. Luna, your familiar (a silver talking cat), sits on your shoulder as you clutch your acceptance letter. The Great Hall bustles with students in colorful robes. Professor Willowmere, the headmistress, stands at the front with a shimmering crystal that sorts new students into houses. Your trunk contains a basic wand, three spell books, and a mysterious family heirloom.

[🎯 Story begins in 30 seconds... Use this time to add your first influences!]

📖 Story View | Story starts in: 27s | Players: 3 | Time left: 10:00
════════════════════════════════════════════════════════════════════
👥 Early Influences (before story begins):
MagicFan2024: "Alex should feel both excited and nervous"
WizardMaster99: "Luna notices something odd about the crystal"

💬 Type your influence: _
```

### 2. Continuous Story Generation with Segments

#### Main Story View (View 1)
```
📖 THORNWICK ACADEMY - Story View          [⏰ 23s] | 👥 3 | 🕐 7:42
════════════════════════════════════════════════════════════════════

Alex stepped through the massive oak doors, the scent of old books 
and magical herbs filling the air. The Great Hall stretched before 
them, its ceiling enchanted to show a swirling galaxy of stars. Luna's 
whiskers twitched as powerful magic permeated every stone. Professor 
Willowmere raised her staff, and the sorting crystal began to glow 
with otherworldly light. "New students, please step forward for the 
House Sorting Ceremony," her voice echoed through the hall.

Other first-years shuffled nervously around Alex, their eyes wide 
with wonder and fear. The crystal pulsed brighter, casting dancing 
shadows across the stone walls. Luna suddenly hissed softly, her 
tail bristling as she sensed something unusual about the magical 
artifact. The headmistress frowned slightly, as if she too noticed 
the crystal's strange behavior. Alex felt the family heirloom in 
their pocket grow warm against their leg.

[🎯 Generating next segment in 15 seconds...]

════════════════════════════════════════════════════════════════════
👥 Recent Player Inputs:
MagicFan2024: "Alex should be nervous about the sorting"
WizardMaster99: "The heirloom is reacting to the crystal"

💬 Type your influence: _
Shift+Tab for other views | Ctrl+C to exit
```

#### Real-Time Input View (View 2 - Multiplayer Only)
```
📝 Live Input View                                    [⏰ 12s] | 👥 4 | 🕐 6:23
════════════════════════════════════════════════════════════════════

👤 SaleemTheGreat: [typing...] maybe Alex should app
👤 MagicFan2024: I think the crystal should crack when Alex
👤 WizardMaster99: what if Luna jumps down and investigate

════════════════════════════════════════════════════════════════════
Recent Story Context:
...Professor Willowmere raised her staff, and the sorting crystal 
began to glow with an otherworldly light.

💬 Type your influence: the headmistress looks worried about some_
Shift+Tab for other views | Ctrl+C to exit
```

#### Chat View (View 3 - Multiplayer Only)
```
💬 Chat View                                          [⏰ 0.8s]
════════════════════════════════════════════════════════════════════

MagicFan2024: This is getting exciting!
WizardMaster99: I love how Luna is so observant
SaleemTheGreat: Should we make this more mysterious?
MagicFan2024: Yeah! What if there's a secret about Alex?
WizardMaster99: Ooh or about the crystal itself

════════════════════════════════════════════════════════════════════
💬 Chat message: _
Shift+Tab for other views | Ctrl+C to exit
```

### 3. Robust Multiplayer Session Management

#### User Join/Drop Handling
```
📖 Story View                              [⏰ 12s] | 👥 4 | 🕐 6:23
════════════════════════════════════════════════════════════════════

🟢 SpellCaster2024 has joined the story!
   Current players: SaleemTheGreat, MagicFan2024, WizardMaster99, SpellCaster2024

The crystal's light intensified as Alex approached, and suddenly 
their family heirloom began glowing through the fabric of their 
pocket...

────────────────────────────────────────────────────────────────────
🔴 MagicFan2024 has temporarily disconnected (attempting reconnection...)
   Current active players: SaleemTheGreat, WizardMaster99, SpellCaster2024

[Story continues normally with remaining players]
────────────────────────────────────────────────────────────────────
🟢 MagicFan2024 has reconnected!
   "You missed one story segment. Catching up..."
```

#### Late Join Experience
```
$ story-chef join MAGIC-FOREST-7429

🌟 Joining Story Chef Session 🌟
Choose your screenname: NewWizard123

Connecting to ongoing story: THORNWICK ACADEMY
Story progress: 4 minutes elapsed (6 minutes remaining)

══════════════════════════════════════════════════════════════════
📚 STORY CATCH-UP - THORNWICK ACADEMY
══════════════════════════════════════════════════════════════════
[Condensed summary of story so far...]

Alex has arrived at Thornwick Academy and discovered their family 
heirloom reacts strangely to the sorting crystal. They've been 
sorted into Ravenclaw House and are now exploring the castle with 
new friends Sarah and Marcus. Luna has been investigating mysterious 
magical disturbances in the castle's foundation...

Current scene: Alex and friends are about to enter the restricted 
section of the library following Luna's lead...
══════════════════════════════════════════════════════════════════

🟢 NewWizard123 has joined the story!
You can now influence the narrative - type anytime!

📖 Story View                              [⏰ 18s] | 👥 5 | 🕐 5:47
```

### 4. Post-Story Rating System

#### Rating Collection Interface
```
📚 THE CONCLUSION 📚

With courage born from newfound friendship, Alex channeled the power 
of their family heirloom to stabilize the ancient magic. The crystal 
stopped its dangerous pulsing, the castle's foundation grew steady, 
and Professor Willowmere smiled with relief. Luna settled contentedly 
on Alex's shoulder as the headmistress announced that this year's 
first-years had already proven themselves true Thornwick students. 
As the friends walked to their first class together, Alex knew this 
was just the beginning of many magical adventures to come.

🎉 STORY COMPLETE! 🎉
Final time: 10:00 | Total segments: 20 | Players: 3

═══════════════════════════════════════════════════════════════
📊 STORY RATING TIME
═══════════════════════════════════════════════════════════════

Please rate this collaborative story experience:

⭐ Overall Story Quality (1-5 stars): _
⭐ Collaboration Experience (1-5 stars): _
⭐ AI Story Generation (1-5 stars): _
⭐ Technical Experience (1-5 stars): _

💭 Optional Comments (press Enter to skip):
What did you think of this story? Any suggestions for improvement?
_

[Waiting for all players to submit ratings...]

👥 Rating Progress:
✅ SaleemTheGreat - Completed
🔄 MagicFan2024 - In progress...  
⏳ WizardMaster99 - Waiting...
```

### 5. Enhanced Story Export with Ratings

#### Comprehensive Markdown Output with Ratings
```markdown
# Thornwick Academy
*A collaborative story by SaleemTheGreat, MagicFan2024, and WizardMaster99*

## Session Information
- **Duration**: 10:00 minutes (20 segments)
- **Initial Delay**: 30 seconds
- **Players**: 3 total
- **Theme**: Magic School  
- **Age Target**: 6-8 years
- **Generated**: August 23, 2025 at 2:47 PM

## The Story
*Generated in real-time segments with continuous player influence*

[Full story content...]

---

## Player Ratings & Feedback

### Overall Ratings Summary
- **Story Quality**: 4.3/5 ⭐⭐⭐⭐⭐
- **Collaboration**: 4.7/5 ⭐⭐⭐⭐⭐  
- **AI Generation**: 4.0/5 ⭐⭐⭐⭐⭐
- **Technical**: 4.3/5 ⭐⭐⭐⭐⭐

### Individual Player Ratings

**SaleemTheGreat (Host)**
- Story Quality: 4/5 ⭐⭐⭐⭐
- Collaboration: 5/5 ⭐⭐⭐⭐⭐
- AI Generation: 4/5 ⭐⭐⭐⭐  
- Technical: 4/5 ⭐⭐⭐⭐
- *Comments*: "I loved how the AI wove everyone's ideas together! The magic school theme was perfect and Luna was a great character. Maybe the segments could be a tiny bit longer next time."

### Session Analytics

### Story Timeline with Initial Delay
**Setup Phase** (0:00-0:30)
- Initial scene presented
- Player influences collected: 5 total
- Early themes: nervousness, crystal mystery, friendship

**Story Generation** (0:30-10:00)  
- 20 segments generated
- Average player engagement: 89%
- Total influences processed: 87
```

## Technical Architecture

### Core Components
```javascript
// Continuous story generation with segments
class StoryEngine {
  constructor(config) {
    this.segmentLength = config.storyPacing.segmentLength;
    this.segmentDelay = config.storyPacing.segmentDelay;
    this.initialDelay = config.storyPacing.initialDelay;
    this.timeLimit = config.storyPacing.storyTimeLimit;
  }
  
  async generateSegment(context, userInputs) {
    // Process all pending user inputs
    // Generate 4-6 sentence segment
    // Update story state
  }
  
  startContinuousGeneration() {
    // Initial delay before first segment
    // Timer-based segment generation
    // Input integration
    // Real-time updates
  }
}

// Multi-view terminal interface  
class TerminalViews {
  constructor() {
    this.views = ['story', 'liveInput', 'chat'];
    this.currentView = 0;
  }
  
  cycleView() { /* Shift+Tab handling */ }
  updateView(viewName, content) { /* Real-time updates */ }
}

// Session management with robust connection handling
class SessionManager {
  constructor() {
    this.activeSessions = new Map();
    this.playerStates = new Map();
    this.reconnectQueues = new Map();
  }
  
  handlePlayerDisconnect(playerId, sessionId) {
    // Keep player slot for 60 seconds
    // Continue story with remaining players
    // Queue player for reconnection
  }
  
  handlePlayerReconnect(playerId) {
    // Restore player state
    // Send missed story segments
    // Resume normal participation
  }
  
  handleLateJoin(playerId, sessionId) {
    // Generate story summary
    // Add player to active session
    // Notify other players
  }
}

// Rating system
class RatingSystem {
  constructor() {
    this.ratings = new Map();
    this.ratingQuestions = [
      { key: 'storyQuality', text: 'Overall Story Quality (1-5)', desc: 'How engaging and well-crafted was the final story?' },
      { key: 'collaboration', text: 'Collaboration Experience (1-5)', desc: 'How well did multiplayer collaboration work?' },
      { key: 'aiGeneration', text: 'AI Story Generation (1-5)', desc: 'How good was the AI at incorporating your influences?' },
      { key: 'technical', text: 'Technical Experience (1-5)', desc: 'How smooth was the app performance and interface?' }
    ];
  }
  
  async collectPlayerRating(playerId) {
    const rating = {};
    
    for (const question of this.ratingQuestions) {
      rating[question.key] = await this.promptForRating(question);
    }
    
    rating.comments = await this.promptForComments();
    rating.timestamp = new Date();
    
    this.ratings.set(playerId, rating);
    return rating;
  }
}
```

## File Structure
```
story-chef/
├── src/
│   ├── cli.js (main entry)
│   ├── server.js (multiplayer server)
│   ├── client.js (game client)
│   ├── gameSession.js (session management)
│   ├── storyEngine.js (AI + story logic)
│   ├── inputProcessor.js (real-time input handling)
│   ├── ratingSystem.js (post-story ratings)
│   ├── exportEngine.js (markdown generation)
│   └── ui/
│       ├── singlePlayer.js
│       ├── multiplayer.js
│       └── viewManager.js
├── prompts/
│   ├── adventure-base.txt
│   ├── mystery-base.txt
│   └── fantasy-base.txt
├── exports/
│   └── [generated story files]
├── story-chef.config.json
└── package.json
```

## Development Phases

### Phase 1: Core with Configurable Timing (3-4 weeks)
- Multi-sentence AI generation system
- Configurable initial delay vs segment delay
- Time-limited stories with automatic conclusion
- Rating collection system
- Enhanced markdown export with ratings

### Phase 2: Robust Session Management (4-5 weeks)  
- Comprehensive disconnect/reconnect handling
- Late join with story catch-up system
- Player state persistence
- Session recovery mechanisms
- Rating synchronization across players

### Phase 3: Advanced Features & Polish (3-4 weeks)
- Multi-view terminal interface with Blessed.js
- Real-time rating progress indicators
- Session analytics with rating correlations
- Performance optimization
- Comprehensive testing and refinement

## Key Features Summary

### Core Mechanics
- **Segment-based Generation**: 4-6 sentences every 30 seconds
- **Configurable Initial Delay**: 30-second setup phase for early influences
- **Time-Limited Stories**: 10-minute maximum with automatic conclusion
- **Real-time Input**: Players can influence story at any moment
- **Multi-view Interface**: Story/Live Input/Chat views (Shift+Tab cycling)

### Multiplayer Features
- **Up to 100 Players**: Scalable real-time collaboration
- **Robust Connection Handling**: Seamless disconnect/reconnect
- **Late Joins**: Players can join mid-story with catch-up
- **Real-time Notifications**: Player join/leave alerts
- **Session Persistence**: Maintains state across connections

### Post-Story Features
- **Rating System**: 4-category ratings plus optional comments
- **Comprehensive Export**: Story + influences + ratings + analytics
- **Session Analytics**: Detailed participation and engagement metrics
- **Player Impact Tracking**: Individual contribution measurement

### Technical Features
- **CLI-based Interface**: Terminal-native experience similar to Claude Code
- **AI Integration**: OpenAI/Claude API support with configurable models
- **Theme Selection**: AI-generated age-appropriate themes
- **Configuration System**: Comprehensive JSON-based settings
- **Export System**: Rich markdown output with complete session data

This creates a complete, resilient storytelling experience that scales from solo play to large group adventures with meaningful feedback collection and detailed documentation of the creative process.