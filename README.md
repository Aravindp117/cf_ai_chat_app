# Cloudflare AI Chat - Full Stack Application

Complete frontend and backend for a Cloudflare AI Chat application with memory and an Agentic Study & Life Planner.

## Project Structure

```
.
├── frontend/          # React + Vite + TypeScript frontend
└── cf_ai_memchat/     # Cloudflare Worker backend
    └── worker/        # Worker source code
        ├── src/
        │   ├── types.ts                    # Phase 1: Data models
        │   ├── durable-objects/            # Phase 2: Durable Objects
        │   │   ├── UserStateDO.ts         # User state management
        │   │   └── index.ts
        │   ├── index.ts                    # Phase 3: Hono API routes
        │   └── memory.ts                   # Chat memory (original)
```

## Features

### Frontend
- 💬 Modern React chat interface
- 🎨 TailwindCSS styling with dark mode
- 🔄 Dynamic user IDs stored in localStorage
- 📱 Responsive design
- ⚡ Vite for fast development

### Backend
- 🤖 Cloudflare Workers AI integration
- 💾 Durable Objects for per-user memory
- 🔄 Conversation memory (last 10 turns)
- ✅ CORS headers configured
- 🚀 Serverless deployment

### Study Planner (Phases 1-6)
- 📚 Goal management (exams, projects, commitments)
- 📖 Topic tracking with spaced repetition
- 📝 Study session logging
- 🤖 AI-powered daily plan generation
- 🎯 Memory decay tracking (green/yellow/orange/red)
- ⚡ Urgency scoring based on deadlines and priority
- 📅 Calendar visualization with week/month views
- 🧠 Memory Matrix for topic decay visualization

## Implementation Phases

### Phase 1: Data Models & Core Architecture ✅
**Location:** `cf_ai_memchat/worker/src/types.ts`

Created comprehensive TypeScript data models:
- **Goal Model**: Study goals with deadlines, priorities, and topics
- **Topic Model**: Individual topics with review tracking and mastery levels
- **StudySession Model**: Logged study sessions
- **DailyPlan Model**: AI-generated daily study plans
- **UserState Model**: Complete user state stored in Durable Objects

Helper functions:
- `calculateMemoryDecayLevel()` - Determines review urgency (green/yellow/orange/red)
- `getSpacedRepetitionInterval()` - Calculates review intervals (1, 3, 7, 14, 30 days)
- `getUrgencyScore()` - Scores goal urgency (0-100) based on deadline and priority
- Additional utilities for topic review scheduling and goal management

### Phase 2: Durable Object Implementation ✅
**Location:** `cf_ai_memchat/worker/src/durable-objects/UserStateDO.ts`

Created `UserStateDO` Durable Object class with:

**Storage Methods:**
- `getState()` - Retrieves user state, creates default if none exists
- `setState()` - Persists state with `waitUntil()` for reliability

**Goal Management:**
- `addGoal()` - Create new goal with auto-generated ID
- `updateGoal()` - Update existing goal
- `deleteGoal()` - Remove goal and associated data

**Topic & Session Management:**
- `addTopic()` - Add topic to a goal
- `recordSession()` - Log study session and update topic stats
- `getTopicsNeedingReview()` - Get topics sorted by urgency

**Daily Plan Management:**
- `generateDailyPlan()` - Store AI-generated plan
- `getDailyPlan()` - Retrieve plan for specific date
- `getGoalsWithDecay()` - Get goals with memory decay indicators

All methods include proper error handling, validation, and HTTP response codes.

### Phase 3: Worker API Routes ✅
**Location:** `cf_ai_memchat/worker/src/index.ts`

Implemented Hono-based RESTful API with 8 endpoints and enhanced chat with command detection:

1. **POST /api/goals** - Create new goal
   - Body: `{ title, type, deadline, priority, topics: string[] }`
   - Returns: Goal object

2. **GET /api/goals** - List all active goals with memory decay indicators
   - Returns: Goal[] with decay information

3. **PUT /api/goals/:id** - Update goal
   - Body: Partial<Goal>
   - Returns: Updated Goal

4. **DELETE /api/goals/:id** - Archive goal
   - Returns: Success confirmation

5. **POST /api/sessions** - Record study session
   - Body: `{ topicId, goalId, durationMinutes, notes }`
   - Automatically updates topic review stats

6. **GET /api/plan/:date** - Get daily plan for date (YYYY-MM-DD)
   - Returns: DailyPlan or 404

7. **POST /api/plan/generate** - Generate today's plan using AI
   - Body: `{ date?: string }` (optional, defaults to today)
   - Uses Cloudflare Workers AI to generate personalized study plan
   - Returns: Generated DailyPlan

8. **GET /api/review** - Get topics needing review (sorted by urgency)
   - Query param: `asOfDate` (optional)
   - Returns: Topic[] sorted by urgency

**Architecture:**
- User identification via `X-User-Id` header or `userId` query param
- All routes use Durable Object for state management
- Comprehensive error handling and validation
- CORS enabled for all routes
- Chat commands: `!today`, `!plan`, `!goals`, `!review`, `!help`

### Phase 4: AI Agent Module ✅
**Location:** `cf_ai_memchat/worker/src/agent/`

Created intelligent AI agent for plan generation:
- **planner.ts**: `generateDailyPlan()` function with retry logic (3 attempts)
- **prompts.ts**: Structured prompt templates with full user context
- Uses existing Workers AI binding (`@cf/meta/llama-3-8b-instruct`)
- JSON extraction with fallback handling
- Task validation against user goals and topics

### Phase 5: React Frontend ✅
**Location:** `frontend/src/`

Complete React application with:
- **Pages**: Dashboard, Goals, Calendar, Chat
- **Components**: GoalCard, DailyPlanView, TopicDecayIndicator, StudySessionModal, CommandChat, Navigation
- **State Management**: React Context for global state
- **API Client**: Typed fetch helpers for all endpoints
- **Routing**: React Router with navigation

### Phase 6: Calendar & Memory Visualization ✅
**Location:** `frontend/src/components/` and `frontend/src/utils/`

Advanced visualization features:

### Phase 7: Integration & Polish ✅
**Location:** `frontend/src/` and configuration files

Final integration and production-ready features:
- **Command Parser** (`utils/commands.ts`): Structured command parsing with validation
- **Enhanced Chat Integration**: Commands integrated with conversational AI, better error handling
- **Error Handling**: Improved error messages, loading states, graceful offline handling
- **Navigation**: Active route highlighting, sidebar navigation
- **Environment Setup**: `vite.config.ts` with proxy, `.env.example` for configuration
- **Testing Setup**: Vitest tests for memory utilities and command parsing
- **Production Config**: Updated `wrangler.json` and deployment scripts

**Bug Fixes:**
- Fixed generate plan button (proper date handling and error messages)
- Fixed create goal button (ISO date conversion and better error handling)

Advanced visualization features:
- **Calendar Component** (`Calendar.tsx`):
  - Week/month view with planned tasks
  - Tasks displayed as colored blocks by priority (red/yellow/green)
  - Click tasks to see details
  - Click empty slots to add ad-hoc study sessions
  - Uses `date-fns` for date manipulation
  - Fetches plans for visible dates automatically

- **Memory Matrix Component** (`MemoryMatrix.tsx`):
  - Grid and list view modes
  - Shows all topics across all goals
  - Color-coded by memory decay (green/yellow/orange/red)
  - Displays: name, goal, last reviewed, review count, mastery level, next review date
  - Sorted by urgency (red topics first)
  - Click topic to log review session

- **Memory Utilities** (`utils/memory.ts`):
  - `getDecayColor()` - Calculate decay level based on days since review
  - `getNextReviewDate()` - Spaced repetition intervals
  - `getUrgencyScore()` - Urgency scoring for sorting
  - `isDueForReview()` - Check if topic needs review
  - `getDaysUntilReview()` - Days until next review

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Backend Setup

```bash
cd cf_ai_memchat/worker
npm install
npm run dev    # Local development with wrangler
npm run deploy # Deploy to Cloudflare Workers
```

## API Usage Examples

### Create a Goal
```bash
POST /api/goals
Headers: X-User-Id: user123
Body: {
  "title": "Math Final Exam",
  "type": "exam",
  "deadline": "2024-12-15T00:00:00Z",
  "priority": 5,
  "topics": ["Algebra", "Calculus", "Statistics"]
}
```

### Record a Study Session
```bash
POST /api/sessions
Body: {
  "topicId": "topic_123",
  "goalId": "goal_456",
  "durationMinutes": 45,
  "notes": "Reviewed algebra basics"
}
```

### Generate Daily Plan
```bash
POST /api/plan/generate
Body: {
  "date": "2024-11-15"
}
```

### Get Topics Needing Review
```bash
GET /api/review?userId=user123
```

## Deploy

### Quick Deploy (Using Scripts)

**Deploy everything:**
```powershell
.\deploy-all.ps1
```

**Deploy individually:**
```powershell
.\deploy-backend.ps1   # Backend only
.\deploy-frontend.ps1  # Frontend only
```

### Manual Deploy

**Frontend (Cloudflare Pages):**
```powershell
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=cloudflare-ai-chat
```

**Backend (Cloudflare Workers):**
```powershell
cd cf_ai_memchat\worker
npm run deploy
```

📖 **See [DEPLOY.md](DEPLOY.md) for detailed deployment guide**

## Environment Variables

The frontend uses the backend API endpoint. Update `frontend/src/components/Chat.tsx` if needed:
- Default: `https://cf-ai-memchat-worker.aravindpillarisetty.workers.dev/api/chat`
- Or set `VITE_API_URL` in `.env` file

## User IDs

Each user gets a unique ID stored in localStorage. This ID is used to maintain separate conversation memories and study planner state per user.

## Dependencies

### Backend
- `hono` - Fast web framework for Cloudflare Workers
- `@cloudflare/workers-types` - TypeScript types
- `wrangler` - Cloudflare Workers CLI

### Frontend
- `react` - UI framework
- `vite` - Build tool
- `tailwindcss` - Styling
- `react-router-dom` - Routing
- `date-fns` - Date manipulation

## License

MIT
