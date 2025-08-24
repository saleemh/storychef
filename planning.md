# Story Chef - CLI Interactive Storytelling App Plan

## Core Concept
A client-server command-line interactive storytelling app that generates stories continuously using AI models, 4-6 sentences at a time every 30 seconds. Users seed the initial story themselves and can inject custom instructions at any moment to influence the narrative in real-time. Stories have a 10-minute time limit with automatic conclusion. Features persistent server sessions, robust multiplayer with seamless join/drop handling, and streamlined post-story rating system.

## Technology Stack
- **Architecture**: Client-server separation with Socket.io communication
- **Server**: Node.js server handling AI integration, session management, and logging
- **Client**: Terminal-based client connecting to local or remote servers
- **Configuration**: JSON config files with in-game editing interface
- **AI Integration**: LiteLLM for unified access to 100+ LLM providers (OpenAI, Claude, Ollama, etc.)
- **Networking**: Socket.io for real-time multiplayer with reconnection handling
- **File System**: Server-side logging, session persistence, and story exports
- **CLI Framework**: Commander.js for argument parsing
- **Terminal UI**: Blessed.js for multiple view management and real-time updates
- **Session Management**: Redis or in-memory store for persistent game sessions with auto-cleanup
- **Performance**: Connection pooling, AI request queuing, memory-efficient session storage

## Configuration System (`story-chef.config.json`)
```json
{
  "aiModel": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.8,
    "maxTokens": 300
  },
  "prompts": {
    "configFile": "./prompts/story-prompts.pdl"
  },
  "storyPacing": {
    "seedingTime": 30000,
    "segmentDelay": 30000,
    "segmentLength": "4-6 sentences",
    "storyTimeLimit": 600000
  },
  "server": {
    "port": 3000,
    "maxPlayers": 100,
    "maxConcurrentSessions": 50,
    "allowLateJoins": true,
    "reconnectTimeout": 60000,
    "logLevel": "info",
    "sessionCleanupInterval": 300000,
    "aiRequestQueue": {
      "maxConcurrent": 10,
      "timeout": 30000
    }
  },
  "webFrontend": {
    "enabled": false,
    "port": 3001,
    "staticPath": "./web"
  }
}
```

### Configuration Options
- **aiModel.provider**: LiteLLM provider format (e.g., "openai", "anthropic", "ollama/llama3")
- **aiModel.model**: LiteLLM model format (e.g., "gpt-4o", "claude-3-5-sonnet-20241022", "llama3")
- **aiModel.temperature**: Model creativity/randomness (0.0-2.0, default: 0.8)
- **aiModel.maxTokens**: Maximum tokens per AI response (default: 300)
- **prompts.configFile**: Path to PDL prompt configuration file
- **storyPacing.seedingTime**: Time allowed for initial story seeding (default: 30 seconds)
- **storyPacing.segmentDelay**: Time between story segments (default: 30 seconds)
- **storyPacing.segmentLength**: Target length for each story segment
- **storyPacing.storyTimeLimit**: Maximum story duration in milliseconds (default: 10 minutes)
- **server.port**: Server port number (default: 3000)
- **server.maxPlayers**: Maximum players per session (default: 100)
- **server.maxConcurrentSessions**: Maximum concurrent sessions (default: 50)
- **server.allowLateJoins**: Whether players can join mid-story (default: true)
- **server.reconnectTimeout**: Reconnection timeout in milliseconds (default: 60 seconds)
- **server.logLevel**: Server logging verbosity ("error", "warn", "info", "debug")
- **server.sessionCleanupInterval**: Auto-cleanup interval for ended sessions (default: 5 minutes)
- **server.aiRequestQueue.maxConcurrent**: Max simultaneous AI requests (default: 10)
- **server.aiRequestQueue.timeout**: AI request timeout (default: 30 seconds)
- **webFrontend.enabled**: Enable web terminal interface (default: false)
- **webFrontend.port**: Web frontend port (default: 3001)
- **webFrontend.staticPath**: Path to web frontend files

### Multi-Session Server Logging
The server handles multiple concurrent sessions with session-specific logging:
```
[2025-08-24 14:25:30] INFO: [MAGIC-FOREST-7429] Segment 5 generated (4 players active)
[2025-08-24 14:25:31] INFO: [OCEAN-QUEST-1834] Story seeding extended, player requested more time
[2025-08-24 14:25:45] INFO: [SPACE-ODYSSEY-9012] New session created
[2025-08-24 14:25:48] WARN: [MAGIC-FOREST-7429] Player 'MagicFan2024' disconnected, attempting reconnection
[2025-08-24 14:26:00] INFO: [OCEAN-QUEST-1834] Segment 1 generated (2 players active)
[2025-08-24 14:26:05] INFO: [MAGIC-FOREST-7429] Player 'MagicFan2024' reconnected successfully
[2025-08-24 14:26:15] INFO: [SPACE-ODYSSEY-9012] Player 'StarTraveler' joined from 192.168.1.88
```

### In-Game Configuration Panel
Press `C` during the pre-game setup to access the configuration panel:
```
⚙️ CONFIGURATION PANEL
══════════════════════════════════════════════════════════════════
1. AI Provider: openai (LiteLLM)
2. AI Model: gpt-4o
3. Temperature: 0.8 (creativity)
4. Story Duration: 10 minutes
5. Segment Timing: 30 seconds
6. Seeding Time: 30 seconds
7. Max Players: 100
8. Allow Late Joins: Yes

Select option to edit (1-8) or press ESC to return: _

Available Providers: openai, anthropic, ollama/llama3, together_ai/meta-llama, etc.
```

### PDL Prompt Configuration (`prompts/story-prompts.pdl`)
```yaml
description: Story Chef Prompt Templates
defs:
  story_segment_generation:
    model: ${model_provider}/${model_name}
    parameters:
      temperature: ${temperature}
      max_tokens: ${max_tokens}
    input: |
      You are a creative storytelling AI helping to generate an interactive story.
      
      Current story context:
      ${story_context}
      
      Player influences for this segment:
      ${player_influences}
      
      Generate the next 4-6 sentences that:
      - Continue the narrative naturally
      - Incorporate player influences creatively
      - Maintain story coherence
      - End with an engaging hook for the next segment
      
      Story segment:

  story_segment_with_direct:
    model: ${model_provider}/${model_name}
    parameters:
      temperature: ${temperature}
      max_tokens: ${max_tokens}
    input: |
      You are generating the next segment of an interactive story that includes both player influences and direct story contributions.
      
      Current story context:
      ${story_context}
      
      Player influences to incorporate:
      ${player_influences}
      
      Player direct story contributions to weave in:
      ${player_direct_content}
      
      Generate the next 4-6 sentences that:
      - Naturally incorporate the direct player content
      - Blend in the player influences seamlessly
      - Maintain story coherence and flow
      - Continue the narrative toward the next segment
      
      Story segment:

  story_conclusion:
    model: ${model_provider}/${model_name}
    parameters:
      temperature: ${temperature}
      max_tokens: ${max_tokens}
    input: |
      You are concluding an interactive story that has been running for 10 minutes.
      
      Story context:
      ${story_context}
      
      Player influences:
      ${player_influences}
      
      Player direct contributions:
      ${player_direct_content}
      
      Create a satisfying conclusion in 4-6 sentences that:
      - Wraps up the main narrative threads
      - Incorporates final player influences and direct content
      - Provides a sense of completion
      - Ends on a positive, memorable note
      
      Final story segment:

  author_contribution_summary:
    model: ${model_provider}/${model_name}
    parameters:
      temperature: 0.3
      max_tokens: 200
    input: |
      Analyze this author's contribution to a collaborative storytelling session and write a concise summary of their involvement style and impact.
      
      Author: ${author_name}
      Role: ${author_role} 
      
      Contribution Statistics:
      - Direct story additions: ${direct_words} words (${direct_percentage}% of player content)
      - Influence suggestions: ${influence_words} words across ${influence_count} inputs
      - Total contributions: ${total_inputs}
      - Most active during: ${active_period}
      
      Sample contributions:
      ${sample_contributions}
      
      Key themes in their contributions:
      ${contribution_themes}
      
      Write a 3-4 sentence summary that captures:
      - Their unique storytelling style and focus areas
      - How they influenced the narrative direction
      - Their collaborative approach with other authors
      - Their distinctive contribution to the story's development
      
      Author Summary:
```

## Enhanced Features

### 1. Client-Server Architecture

#### Starting the Server
```bash
# Start server mode (runs continuously)
$ story-chef server
🖥️  Story Chef Server starting...
✅ Server running on port 3000
📊 Session logging enabled (level: info)
🔄 Waiting for client connections...

[2025-08-24 14:23:15] INFO: [MAGIC-FOREST-7429] New session created
[2025-08-24 14:23:18] INFO: [MAGIC-FOREST-7429] Player 'SaleemTheGreat' joined from 192.168.1.100
[2025-08-24 14:23:22] INFO: [MAGIC-FOREST-7429] Player 'MagicFan2024' joined from 192.168.1.105
[2025-08-24 14:23:45] INFO: [OCEAN-QUEST-1834] New session created
[2025-08-24 14:23:50] INFO: [OCEAN-QUEST-1834] Player 'AdventureSeeker' joined from 192.168.1.120
[2025-08-24 14:24:12] INFO: [MAGIC-FOREST-7429] Story seeding phase completed, 3 seeds collected
[2025-08-24 14:24:15] INFO: [MAGIC-FOREST-7429] Story generation started
[2025-08-24 14:24:18] INFO: [OCEAN-QUEST-1834] Player 'DeepDiver99' joined from 192.168.1.125
```

#### Starting the Client
```bash
# Connect to local server (default)
$ story-chef start

# Connect to remote server
$ story-chef start --server ws://story-server.example.com:3000
```

### 2. Game Initialization with User-Seeded Stories
```
$ story-chef start

🌟 Welcome to Story Chef! 🌟
Connecting to server...
✅ Connected to Story Chef Server

Your game code: MAGIC-FOREST-7429

═══════════════════════════════════════════════════════════════
🎮 GAME SETUP
═══════════════════════════════════════════════════════════════
👥 Players: 3 (SaleemTheGreat, MagicFan2024, WizardMaster99)
⏰ Story Duration: 10 minutes total
📖 New story segment every 30 seconds
💭 Two input modes: Direct Story Writing & Influence Suggestions
🔄 Press Shift+Tab to cycle between views (Story/Direct/Influence/Live/Chat)
⚙️ Press C to open configuration panel
═══════════════════════════════════════════════════════════════

📝 SEED YOUR STORY 📝

Describe the setting, characters, or situation you'd like to explore.
Be as creative as you want - this will shape the entire story!

[⏰ 30 seconds to seed your story | Press ↓ to skip early]

💬 Type your story seed: In a magical academy where students learn to control the elements, a new student arrives with a mysterious talking cat who can sense ancient magic hidden in the school's foundations..._

👥 Other Players' Seeds:
MagicFan2024: "The protagonist should feel nervous but excited"
WizardMaster99: "There's something strange about the sorting crystal"

[⏰ 12 seconds remaining | Press ↓ to start story now]
```

### 3. Skip Controls and Fast-Forward

#### Single Player Skip
```
📖 Story View                                [⏰ 15s] | 👥 1 | 🕐 8:42
════════════════════════════════════════════════════════════════════

[Story content...]

[🎯 Generating next segment in 15 seconds...]

💬 Type your influence or press ↓ to skip wait: _
```

#### Multiplayer Skip Coordination
```
📖 Story View                                [⏰ 18s] | 👥 4 | 🕐 6:23
════════════════════════════════════════════════════════════════════

[Story content...]

[🎯 Generating next segment in 18 seconds...]

⚡ Skip Status: 2/4 players ready (MagicFan2024, WizardMaster99)
   Press ↓ to skip wait • All players must agree to skip

💬 Type your influence or press ↓ to skip: _
```

### 4. Dual Input Modes & Multi-View Interface

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

💬 [INFLUENCE MODE] Type your influence: _
Shift+Tab for other views | Ctrl+C to exit
```

#### Direct Story Input View (View 2)
```
✍️ DIRECT STORY INPUT - Story View              [⏰ 23s] | 👥 3 | 🕐 7:42
════════════════════════════════════════════════════════════════════

Recent story context:
...Alex felt the family heirloom in their pocket grow warm against 
their leg.

[🎯 Next segment generates in 23 seconds...]

Write exact text to include in the story:

💬 [DIRECT MODE] Add to story: The crystal suddenly cracked, sending a brilliant silver light cascading across the hall. Alex gasped as their heirloom began to glow in response, and Luna's eyes widened with ancient recognition._
Shift+Tab for other views | Ctrl+C to exit
```

#### Influence Input View (View 3)  
```
💭 INFLUENCE INPUT - Story View                 [⏰ 23s] | 👥 3 | 🕐 7:42
════════════════════════════════════════════════════════════════════

Recent story context:
...Alex felt the family heirloom in their pocket grow warm against 
their leg.

[🎯 Next segment generates in 23 seconds...]

Guide the story direction:

💬 [INFLUENCE MODE] Story should focus on: The mysterious connection between Alex's heirloom and the sorting crystal, maybe there's ancient magic at play_
Shift+Tab for other views | Ctrl+C to exit
```

#### Live Input View (View 4 - Multiplayer Only)
```
📝 Live Input View                                    [⏰ 12s] | 👥 4 | 🕐 6:23
════════════════════════════════════════════════════════════════════

👤 SaleemTheGreat [DIRECT]: The crystal pulsed with an ominous energy...
👤 MagicFan2024 [INFLUENCE]: Alex should feel a connection to the crystal
👤 WizardMaster99 [DIRECT]: Luna's fur stood on end as she sensed danger
👤 NewPlayer [INFLUENCE]: [typing...] maybe the headmistress knows

════════════════════════════════════════════════════════════════════
Recent Story Context:
...Professor Willowmere raised her staff, and the sorting crystal 
began to glow with an otherworldly light.

💬 [INFLUENCE MODE] Type your influence: the headmistress looks worried about some_
Shift+Tab to change input mode | Ctrl+C to exit
```

#### Chat View (View 5 - Multiplayer Only)
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

### 5. Simplified Post-Story Rating System

#### Streamlined Rating Collection
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
📊 STORY RATING
═══════════════════════════════════════════════════════════════

How was this story experience?

⭐ Rating (1-5 stars): _

💭 Optional Comments (press Enter to skip):
Any thoughts about this story?
_

[Waiting for all players to submit ratings...]

👥 Rating Progress:
✅ SaleemTheGreat - Completed (4⭐)
🔄 MagicFan2024 - In progress...  
⏳ WizardMaster99 - Waiting...
```

### 6. Web Terminal Frontend

#### Browser-Based Terminal Experience
```bash
# Start server with web frontend enabled
$ story-chef server --web

🖥️  Story Chef Server starting...
✅ Server running on port 3000
🌐 Web frontend available at http://localhost:3001
📊 Session logging enabled (level: info)
🔄 Waiting for client connections...
```

#### Web Terminal Interface
Users can visit `http://localhost:3001` and get a full terminal experience:

```html
<!-- Minimal terminal-like web interface -->
<!DOCTYPE html>
<html>
<head>
    <title>Story Chef</title>
    <link rel="stylesheet" href="xterm.css" />
    <style>
        body { margin: 0; padding: 20px; background: #1e1e1e; font-family: monospace; }
        #terminal { height: 90vh; }
        .terminal-header { color: #00ff00; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="terminal-header">🌟 Story Chef - Web Terminal</div>
    <div id="terminal"></div>
    
    <script src="socket.io.min.js"></script>
    <script src="xterm.min.js"></script>
    <script src="story-chef-web.js"></script>
</body>
</html>
```

#### Web Client Features
- **Identical CLI Experience**: Same commands, UI, and functionality as terminal client
- **Real-time Collaboration**: Full multiplayer support through Socket.io
- **Mobile Responsive**: Works on tablets and phones with touch keyboard
- **Copy/Paste Support**: Standard web copy/paste functionality
- **Session Sharing**: Easy to share game URLs for quick joins

#### Example Web Experience
```
🌟 Welcome to Story Chef! 🌟
Connected to server at localhost:3000
Choose an option:
1. Start new story
2. Join existing story
3. Configure settings

> 1

Creating new story session...
Your game code: MAGIC-FOREST-7429
Share this URL with friends: http://localhost:3001/join/MAGIC-FOREST-7429

═══════════════════════════════════════════════════════════════
🎮 GAME SETUP
═══════════════════════════════════════════════════════════════
👥 Players: 1 (WebUser_1234)
⏰ Story Duration: 10 minutes total
📖 New story segment every 30 seconds
💭 Type influences anytime - they shape the next segment
⚙️ Press C to open configuration panel
═══════════════════════════════════════════════════════════════

📝 SEED YOUR STORY 📝

Describe the setting, characters, or situation you'd like to explore.
Be as creative as you want - this will shape the entire story!

[⏰ 30 seconds to seed your story | Press ↓ to skip early]

💬 Type your story seed: _
```

### 7. Enhanced Story Export with Authorship Analytics

#### Comprehensive Markdown Output with Contribution Tracking
```markdown
# Thornwick Academy
*A collaborative story by SaleemTheGreat, MagicFan2024, and WizardMaster99*

## Session Information
- **Story Initiator**: SaleemTheGreat (created session MAGIC-FOREST-7429)
- **Duration**: 10:00 minutes (20 segments)
- **Seeding Phase**: 30 seconds (user-seeded story)
- **Players**: 3 total
- **Generated**: August 23, 2025 at 2:47 PM
- **Server**: localhost:3000

## Initial Story Seed
*Player-created story foundation*

**Primary Seed** (SaleemTheGreat): "In a magical academy where students learn to control the elements, a new student arrives with a mysterious talking cat who can sense ancient magic hidden in the school's foundations..." *(62 words)*

**Contributing Seeds**:
- MagicFan2024: "The protagonist should feel nervous but excited" *(9 words)*
- WizardMaster99: "There's something strange about the sorting crystal" *(8 words)*

## The Story
*Generated in real-time segments with continuous player and AI collaboration*

[Full story content with inline attribution markers...]

---

## Authorship & Contribution Analytics

### Story Composition
- **Total Story Length**: 2,847 words
- **AI Generated Content**: 2,234 words (78.5%)
- **Player Direct Contributions**: 613 words (21.5%)
- **Player Influence Inputs**: 1,456 words (processed by AI)

### Individual Author Contributions

#### SaleemTheGreat (Story Initiator)
**Contribution Statistics:**
- Direct Story Additions: 287 words (45.8% of player content)
- Influence Suggestions: 623 words across 15 inputs
- Total Inputs: 18 contributions
- Most Active Period: Segments 5-12 (middle story development)

**AI-Generated Author Summary:**
*SaleemTheGreat served as the story architect, providing the foundational magic school setting and driving key plot developments. Their direct story contributions focused heavily on character development and world-building details, particularly around Alex's mysterious family heirloom and its connection to ancient magic. Their influence suggestions consistently pushed the narrative toward deeper magical mysteries, showing a preference for complex, interconnected plot elements. As the session initiator, they effectively guided the collaborative storytelling while leaving space for other contributors to shape character relationships and emotional moments.*

#### MagicFan2024  
**Contribution Statistics:**
- Direct Story Additions: 198 words (32.3% of player content)
- Influence Suggestions: 445 words across 12 inputs
- Total Inputs: 14 contributions
- Most Active Period: Segments 1-6 (early character establishment)

**AI-Generated Author Summary:**
*MagicFan2024 emerged as the story's emotional heart, consistently focusing on character feelings, relationships, and internal experiences. Their direct contributions specialized in dialogue and character interactions, bringing warmth and relatability to the magical setting. Their influence suggestions frequently emphasized emotional stakes and interpersonal dynamics, particularly around Alex's nervousness and growing friendships. They showed a talent for balancing the magical elements with genuine human emotions, making the fantastical elements feel grounded and accessible.*

#### WizardMaster99
**Contribution Statistics:**  
- Direct Story Additions: 128 words (20.9% of player content)
- Influence Suggestions: 388 words across 11 inputs
- Total Inputs: 13 contributions
- Most Active Period: Segments 8-15 (action and mystery development)

**AI-Generated Author Summary:**
*WizardMaster99 functioned as the story's mystery architect, introducing crucial plot devices and maintaining suspense throughout the narrative. Their contributions consistently focused on Luna the cat's supernatural abilities and the magical dangers lurking within the academy. Their direct story additions were precise and impactful, often introducing key revelations or heightening tension at crucial moments. Their influence suggestions demonstrated strong pacing instincts, knowing when to escalate conflict and when to provide breathing room for character development.*

## Player Ratings & Feedback

### Overall Rating: 4.0/5 ⭐⭐⭐⭐

### Individual Player Ratings

**SaleemTheGreat (Story Initiator)**
- Rating: 4/5 ⭐⭐⭐⭐
- *Comments*: "I loved how the AI wove everyone's ideas together! The magic school theme worked perfectly and the dual input modes gave us so much creative control."

**MagicFan2024**
- Rating: 4/5 ⭐⭐⭐⭐
- *Comments*: "Really fun collaborative experience. Being able to write direct story parts AND give influences was amazing. The skip feature made pacing feel natural."

**WizardMaster99**  
- Rating: 4/5 ⭐⭐⭐⭐
- *Comments*: "Great story! Loved the mystery elements and how Luna became such an important character. The contribution analytics are fascinating!"

### Session Analytics

**Seeding Phase** (0:00-0:30)
- Player seeds collected: 3 total (79 words)
- Skip requests: 1 (story started 12 seconds early)
- Initial themes: magic academy, mysterious elements, character nervousness

**Story Generation** (0:30-10:00)  
- 20 segments generated
- Average player engagement: 89%
- Total direct story inputs: 43 (613 words)
- Total influence inputs: 38 (1,456 words)
- Skip requests used: 5 times (all unanimous)

**Input Mode Usage:**
- Direct Story Mode: 53% of inputs
- Influence Mode: 47% of inputs
- View switching frequency: 2.3 times per player per session
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

// Multi-session management with robust connection handling
class SessionManager {
  constructor() {
    this.activeSessions = new Map(); // sessionId -> Session
    this.playerStates = new Map();   // playerId -> PlayerState
    this.reconnectQueues = new Map(); // playerId -> ReconnectInfo
    this.logger = new SessionLogger();
  }
  
  handlePlayerDisconnect(playerId, sessionId) {
    this.logger.warn(`[${sessionId}] Player '${playerId}' disconnected, attempting reconnection`);
    // Keep player slot for 60 seconds
    // Continue story with remaining players
    // Queue player for reconnection
  }
  
  handlePlayerReconnect(playerId, sessionId) {
    this.logger.info(`[${sessionId}] Player '${playerId}' reconnected successfully`);
    // Restore player state
    // Send missed story segments
    // Resume normal participation
  }
  
  handleLateJoin(playerId, sessionId, ipAddress) {
    this.logger.info(`[${sessionId}] Player '${playerId}' joined from ${ipAddress}`);
    // Generate story summary
    // Add player to active session
    // Notify other players
  }
  
  createSession(sessionId) {
    this.logger.info(`[${sessionId}] New session created`);
    // Create new session instance
  }
}

// Simplified rating system
class RatingSystem {
  constructor() {
    this.ratings = new Map();
  }
  
  async collectPlayerRating(playerId) {
    const rating = {
      stars: await this.promptForStarRating(1, 5),
      comments: await this.promptForComments(),
      timestamp: new Date()
    };
    
    this.ratings.set(playerId, rating);
    return rating;
  }
  
  calculateAverageRating() {
    const ratings = Array.from(this.ratings.values());
    return ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length;
  }
}
```

## File Structure
```
story-chef/
├── src/
│   ├── cli.js (main entry point)
│   ├── server/
│   │   ├── server.js (story chef server)
│   │   ├── webServer.js (express + socket.io web frontend)
│   │   ├── sessionManager.js (session persistence + performance)
│   │   ├── storyEngine.js (LiteLLM + PDL integration)
│   │   ├── aiQueue.js (AI request queuing and rate limiting)
│   │   ├── logger.js (server logging)
│   │   └── ratingSystem.js (rating collection)
│   ├── client/
│   │   ├── client.js (game client)
│   │   ├── ui/
│   │   │   ├── gameView.js
│   │   │   ├── configPanel.js
│   │   │   └── viewManager.js
│   │   └── inputProcessor.js (input handling)
│   ├── shared/
│   │   ├── config.js (config management)
│   │   └── exportEngine.js (markdown generation)
├── web/
│   ├── index.html (xterm.js terminal interface)
│   ├── story-chef-web.js (web client logic)
│   ├── xterm.min.js
│   ├── xterm.css
│   └── socket.io.min.js
├── prompts/
│   └── story-prompts.pdl (PDL prompt templates)
├── logs/
│   └── [server session logs]
├── exports/
│   └── [generated story files]
├── story-chef.config.json
└── package.json
```

## Development Phases

### Phase 1: Core Foundation
**Testable Deliverables:**
- Basic client-server architecture with Socket.io communication
- Server can start/stop and accept client connections
- LiteLLM integration supporting OpenAI, Claude, and local models
- PDL prompt configuration system with template loading
- Single-player story seeding (30-second timer with ↓ skip)
- AI story segment generation using PDL templates
- Basic dual input modes (Direct Story vs Influence)
- Contribution tracking system (word counts, input types)
- Basic terminal UI with Shift+Tab view cycling
- Simple story export with contribution analytics

**Testing:** Can start server, connect client, seed a story, use both Direct and Influence input modes, generate AI segments that weave both input types, and export story with basic analytics.

### Phase 2: Multiplayer & Controls
**Testable Deliverables:**
- Multiplayer sessions with game codes
- Real-time dual-mode input synchronization (Direct/Influence)
- Skip controls requiring unanimous agreement in multiplayer
- Enhanced multi-view interface (Story/Direct/Influence/Live/Chat) with Shift+Tab cycling
- Player join/leave notifications with contribution tracking
- Live input view showing player input modes [DIRECT] vs [INFLUENCE]
- Basic disconnect/reconnect handling

**Testing:** Multiple clients can join same session, use both input modes collaboratively, see each other's input types in real-time, skip segments together, and switch between all 5 views.

### Phase 3: Performance & Scalability
**Testable Deliverables:**
- AI request queuing and rate limiting for concurrent sessions
- Session auto-cleanup and memory management
- Performance monitoring and connection pooling
- In-game configuration panel (C key) with live LiteLLM model switching
- Advanced PDL prompt customization and template management
- Session persistence across server restarts

**Testing:** Server handles 20+ concurrent sessions smoothly, AI requests are properly queued/rate-limited, memory usage stays stable, and model switching works seamlessly.

### Phase 4: Web Terminal Frontend
**Testable Deliverables:**
- Express.js web server with xterm.js terminal interface
- Web-based Socket.io client matching CLI functionality exactly
- Mobile-responsive design with touch keyboard support
- Direct URL sharing for easy session joins (e.g., /join/MAGIC-FOREST-7429)
- Web and CLI clients can participate in same sessions seamlessly

**Testing:** Users can access full Story Chef experience through browser, collaborate with CLI users in real-time, and share session URLs for instant joining.

### Phase 5: Advanced Analytics & Polish
**Testable Deliverables:**
- Late join capability with story catch-up and contribution history
- AI-generated author involvement summaries using PDL templates
- Advanced contribution analytics (word counts, participation patterns, thematic analysis)
- Enhanced exports with detailed authorship attribution and AI author summaries
- Post-story rating system (1-5 stars + comments)
- Server logging with IP addresses and detailed session tracking
- Comprehensive error handling and recovery
- Documentation and deployment guides

**Testing:** Full end-to-end experience including real-time model switching, advanced analytics generation, AI author summaries, mid-session joins with contribution history, complete rating collection, and comprehensive story exports with detailed authorship analysis.

## Key Features Summary

### Core Mechanics
- **User Story Seeding**: Players create initial story foundation (30 seconds)
- **Dual Input Modes**: Direct Story Writing & Influence Suggestions (Shift+Tab to switch)
- **Segment-based Generation**: AI weaves both direct content and influences into 4-6 sentences every 30 seconds
- **Skip Controls**: ↓ key to fast-forward (unanimous in multiplayer)
- **Time-Limited Stories**: 10-minute maximum with automatic conclusion
- **Enhanced Multi-view Interface**: Story/Direct/Influence/Live/Chat views (5 total for multiplayer)
- **Real-time Collaboration**: Players see each other's input modes in live view
- **In-game Configuration**: C key opens config panel with live editing

### Multiplayer Features
- **Up to 100 Players**: Scalable real-time collaboration
- **Robust Connection Handling**: Seamless disconnect/reconnect
- **Late Joins**: Players can join mid-story with catch-up
- **Real-time Notifications**: Player join/leave alerts
- **Session Persistence**: Maintains state across connections

### Post-Story Features
- **Simplified Rating**: Single 1-5 star rating plus optional comments
- **Comprehensive Export**: Story + influences + ratings + analytics
- **Session Analytics**: Detailed participation and engagement metrics
- **Player Impact Tracking**: Individual contribution measurement

### Technical Features
- **Client-Server Architecture**: Persistent server sessions with client connections
- **CLI-based Interface**: Terminal-native experience
- **AI Integration**: LiteLLM supporting 100+ models (OpenAI, Claude, Ollama, local, etc.)
- **Prompt Management**: PDL (Prompt Declaration Language) for flexible prompt engineering
- **Server Logging**: Multi-session aware logging with detailed player activity
- **Configuration System**: JSON config with in-game editing panel supporting model switching
- **Export System**: Rich markdown output with complete session data
- **Flexible Deployment**: Local or remote server connections

This creates a complete, resilient client-server storytelling experience that scales from solo play to large group adventures, with user-driven story creation, flexible pacing controls, server persistence, and streamlined feedback collection.