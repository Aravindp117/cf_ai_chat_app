# Development Prompts - Agentic Study & Life Planner

This document contains the prompts used to build the Cloudflare Workers + Durable Objects Study Planner application. These prompts were given to Cursor one phase at a time to guide the development process.

---

## PHASE 1: Data Models & Core Architecture

```
PHASE 1: Data Models & Core Architecture
I'm building an Agentic Study & Life Planner on Cloudflare Workers with Durable Objects.

Create the following TypeScript data models and types:

1. **Goal Model**:
   - id: string
   - title: string
   - type: 'exam' | 'project' | 'commitment'
   - deadline: ISO date string
   - priority: 1-5 (5 = highest)
   - topics: array of Topic objects
   - status: 'active' | 'completed' | 'archived'
   - createdAt: ISO date string

2. **Topic Model**:
   - id: string
   - goalId: string (foreign key)
   - name: string
   - lastReviewed: ISO date string | null
   - reviewCount: number
   - masteryLevel: 0-100
   - notes: string

3. **StudySession Model**:
   - id: string
   - topicId: string
   - goalId: string
   - date: ISO date string
   - durationMinutes: number
   - notes: string

4. **DailyPlan Model**:
   - date: ISO date string
   - generatedAt: ISO date string
   - tasks: array of PlannedTask
   - reasoning: string (AI's explanation)

5. **PlannedTask Model**:
   - topicId: string
   - goalId: string
   - type: 'study' | 'review' | 'project_work'
   - estimatedMinutes: number
   - priority: 1-5
   - reasoning: string

6. **UserState Model** (this is what the Durable Object stores):
   - userId: string
   - goals: Goal[]
   - sessions: StudySession[]
   - dailyPlans: DailyPlan[]
   - lastPlanGenerated: ISO date string | null

Create these in a file called `src/types.ts` with proper TypeScript interfaces and helper functions for:
- Calculating memory decay level (green/yellow/orange/red) based on lastReviewed date
- Calculating spaced repetition intervals (1 day, 3 days, 7 days, 14 days, 30 days)
- Getting urgency score for a goal based on deadline and priority

Make it clean, well-commented, and ready for a Cloudflare Worker environment.
```

**Result**: Created `cf_ai_memchat/worker/src/types.ts` with all interfaces and helper functions.

---

## PHASE 2: Durable Object Implementation

```
PHASE 2: Durable Object Implementation
I have my data models defined. Now create a Durable Object class called `UserStateDO` that:

1. **Storage**:
   - Uses `this.state.storage` to persist UserState
   - Implements `getState()` and `setState()` methods
   - Auto-saves on every mutation

2. **Methods**:
   - `addGoal(goal: Omit<Goal, 'id' | 'createdAt'>)`: adds a new goal
   - `updateGoal(goalId: string, updates: Partial<Goal>)`: updates existing goal
   - `deleteGoal(goalId: string)`: removes a goal
   - `addTopic(goalId: string, topic: Omit<Topic, 'id' | 'goalId'>)`: adds topic to a goal
   - `recordSession(session: Omit<StudySession, 'id'>)`: logs a study session
   - `getTopicsNeedingReview(asOfDate?: string)`: returns topics sorted by urgency using spaced repetition
   - `generateDailyPlan(date: string, aiReasoning: string, tasks: PlannedTask[])`: stores AI-generated plan
   - `getDailyPlan(date: string)`: retrieves plan for a specific date
   - `getGoalsWithDecay()`: returns goals with memory decay colors for each topic

3. **Architecture**:
   - Use `this.ctx.waitUntil()` for async operations if needed
   - Handle race conditions properly
   - Return proper HTTP responses (200, 404, 400, etc.)
   - Include error handling

Put this in `src/durable-objects/UserStateDO.ts`.

Also create `src/durable-objects/index.ts` that exports the Durable Object for Wrangler.

Make sure it follows Cloudflare Durable Objects best practices.
```

**Result**: Created `cf_ai_memchat/worker/src/durable-objects/UserStateDO.ts` and `cf_ai_memchat/worker/src/durable-objects/index.ts`.

---

## PHASE 3: Worker API Routes

```
PHASE 3: Worker API Routes
Create a Cloudflare Worker with the following API routes. Use Hono for routing.

**Routes**:

1. `POST /api/goals` - Create new goal
   - Body: { title, type, deadline, priority, topics: string[] }
   - Returns: Goal object

2. `GET /api/goals` - List all active goals
   - Returns: Goal[] with memory decay indicators

3. `PUT /api/goals/:id` - Update goal
   - Body: Partial<Goal>

4. `DELETE /api/goals/:id` - Archive goal

5. `POST /api/sessions` - Record study session
   - Body: { topicId, goalId, durationMinutes, notes }
   - Updates lastReviewed and reviewCount for the topic

6. `GET /api/plan/:date` - Get daily plan for date (YYYY-MM-DD)
   - If plan doesn't exist, return 404
   
7. `POST /api/plan/generate` - Generate today's plan using AI
   - Body: { date: string (optional, defaults to today) }
   - Calls LLM with user state
   - Stores generated plan
   - Returns: DailyPlan

8. `GET /api/review` - Get topics needing review (sorted by urgency)

**Architecture**:
- Each route gets userId from a header or query param (auth can be added later)
- Each route gets the Durable Object stub via: `env.USER_STATE.get(env.USER_STATE.idFromName(userId))`
- Use proper HTTP status codes
- Include error handling and validation

Create this in `src/index.ts` with clean, modular code.

Also update `wrangler.toml` to include the Durable Object binding for USER_STATE with class_name UserStateDO, migrations tag v1, and AI binding.
```

**Note**: Phase 3 was later enhanced to include the existing chat endpoint (`POST /api/chat`) with command detection. The plan generation was modified to use the existing Workers AI LLaMA model.

**Result**: Created `cf_ai_memchat/worker/src/index.ts` with all routes using Hono, and updated `wrangler.json`.

---

## PHASE 4: AI Agent Module

```
Modified Phase 4 prompt:
Create an AI agent module that generates intelligent daily plans using the EXISTING Workers AI LLaMA model.

**File**: `src/agent/planner.ts`

**Function**: `generateDailyPlan(userState: UserState, targetDate: string, ai: Ai): Promise<DailyPlan>`

**Agent Logic**:

1. **Analyze user state** (same as before)

2. **Build LLM prompt** with:
   - System message: "You are a study planner AI for college students. Generate realistic daily plans."
   - User message with:
     - Today's date
     - All active goals with deadlines and priorities
     - Topics with memory decay status (green/yellow/orange/red)
     - Topics needing review
     - Recent study history (last 7 days)
   
3. **LLM Instructions** (in the prompt):
   - Create a realistic 4-6 hour daily study plan
   - Prioritize: (1) red/orange decay topics, (2) urgent deadlines, (3) high-priority goals
   - Mix review and new learning
   - Use spaced repetition principles
   - **IMPORTANT**: Return ONLY valid JSON in this exact format with tasks array and reasoning string

4. **Call Workers AI** using your existing binding with the model @cf/meta/llama-3.1-8b-instruct, temperature 0.7, max_tokens 1500

5. **Parse LLM response**:
   - Extract JSON from response (handle markdown code blocks if present)
   - Validate tasks structure
   - Return DailyPlan object

**Also create**: `src/agent/prompts.ts` with prompt templates.

Make sure to handle cases where LLaMA doesn't return perfect JSON (add retry logic or JSON extraction helpers).
```

**Result**: Created `cf_ai_memchat/worker/src/agent/planner.ts` and `cf_ai_memchat/worker/src/agent/prompts.ts` with robust JSON parsing and error handling.

---

## PHASE 5: React Frontend

```
PHASE 5: Frontend Components (React + TypeScript)
Create a React frontend (using Vite) with these components:

**Pages**:
1. `DashboardPage.tsx` - Main view showing today's plan, goals overview, urgent reviews
2. `GoalsPage.tsx` - List and manage goals
3. `CalendarPage.tsx` - Simple week/month view with planned tasks
4. `ChatPage.tsx` - Chat interface with command support

**Components**:
1. `GoalCard.tsx` - Display goal with deadline countdown, topics with decay colors
2. `DailyPlanView.tsx` - Show today's AI-generated plan with task list
3. `TopicDecayIndicator.tsx` - Visual indicator (green/yellow/orange/red dot or bar)
4. `StudySessionModal.tsx` - Form to log a completed study session
5. `CommandChat.tsx` - Chat with command parsing (!today, !plan, !review, !goals)

**Commands** (parse in frontend, call API):
- `!today` → Shows today's plan
- `!plan` → Generates new plan for today
- `!review` → Shows topics needing review
- `!goals` → Lists active goals
- `!add goal [title]` → Creates new goal (follow-up prompts for details)
- `!log [topicName] [minutes]` → Logs study session

**State Management**:
- Use React Context or Zustand for global state
- Fetch data from Worker API
- Real-time updates after actions

**Styling**:
- Use Tailwind CSS
- Clean, student-friendly UI
- Mobile-responsive

Create these in `src/components/` and `src/pages/`.

Include a `src/api/client.ts` with typed fetch helpers for all API routes.
```

**Result**: Created all frontend pages and components in `frontend/src/`, including React Context for state management and a complete API client.

---

## PHASE 6: Calendar & Memory Visualization

```
PHASE 6: Calendar & Memory Visualization
Add two advanced features:

**1. Calendar Component** (`src/components/Calendar.tsx`):
- Show current week by default (expandable to month view)
- Display planned tasks as colored blocks
- Color by priority (red = high, yellow = medium, green = low)
- Click task to see details
- Click empty slot to add ad-hoc study session
- Use `date-fns` for date manipulation
- Fetch plans via `GET /api/plan/:date` for each visible date

**2. Memory Decay Visualization** (`src/components/MemoryMatrix.tsx`):
- Grid or list view of all topics across all goals
- Each topic shows:
  - Name
  - Goal it belongs to
  - Last reviewed date
  - Memory decay color (green < 3 days, yellow 3-7 days, orange 7-14 days, red > 14 days)
  - Review count
  - Next suggested review date
- Sort by urgency (red topics first)
- Click topic to log review session

**Helper functions** (`src/utils/memory.ts`):
- `getDecayColor(lastReviewed: string | null): 'green' | 'yellow' | 'orange' | 'red'`
- `getNextReviewDate(lastReviewed: string, reviewCount: number): string` (spaced repetition)
- `getUrgencyScore(topic: Topic): number` (for sorting)

Make both components clean, performant, and visually intuitive.
```

**Result**: Created `frontend/src/components/Calendar.tsx`, `frontend/src/components/MemoryMatrix.tsx`, and `frontend/src/utils/memory.ts` with all requested functionality.

---

## PHASE 7: Integration & Polish

```
PHASE 7: Integration & Polish
Final integration phase:

1. **Command Parser** (`src/utils/commands.ts`):
   - Parse chat messages starting with `!`
   - Extract command and arguments
   - Return structured command object
   - Handle errors gracefully

2. **Chat Integration** (update `ChatPage.tsx`):
   - Send normal messages to LLM (conversational AI)
   - Intercept commands and execute via API
   - Display command results in chat
   - Show AI-generated plan reasoning in chat

3. **Error Handling**:
   - Add try-catch to all API calls
   - Show toast notifications for errors
   - Add loading states to all async operations
   - Handle offline gracefully

4. **Navigation** (`src/App.tsx`):
   - React Router with routes: /, /goals, /calendar, /chat
   - Sidebar navigation
   - Active route highlighting

5. **Environment Setup**:
   - `wrangler.toml` configured correctly
   - `vite.config.ts` with proxy to local worker dev server
   - `.env` for API base URL
   - README.md with setup instructions

6. **Testing Setup** (optional but recommended):
   - `src/__tests__/memory.test.ts` - test decay calculations
   - `src/__tests__/commands.test.ts` - test command parsing

7. **Deployment**:
   - Cloudflare Pages for frontend
   - Cloudflare Worker for backend
   - Update `wrangler.toml` with production settings

Make sure all pieces connect properly and the app is production-ready.
```

**Result**: Created command parser, integrated chat, added error handling with toast notifications, set up React Router navigation, configured environment files, and added test files.

---

## Additional Fixes & Enhancements

### Button Debugging Prompt

```
I have a Cloudflare Workers + Durable Objects + React frontend app that's having issues with all button interactions. All buttons are either doing nothing or returning errors like "internal server error" or "goal not found".

CURRENT ISSUES:
1. "Create Goal" button - internal server error
2. "Generate Plan" button - does nothing
3. "Regenerate Plan" button - internal server error
4. "Delete Goal" button - "goal not found" error

I need you to create a COMPLETE, WORKING debugging and fix implementation.

STEP 1: Create proper error logging and debugging infrastructure
Create a debug.ts file with logger utility functions for info and error logging with context and stack traces.

STEP 2: Fix the Durable Object with proper error handling and logging
Rewrite UserStateDO.ts with comprehensive error logging for EVERY operation, proper initialization of state (handle first-time users), validation of all inputs, return proper error responses with details, add a fetch() handler that routes to methods correctly, make sure storage operations use await properly, add console.log statements to track execution flow. Key fixes needed: Check if state exists before reading (handle null/undefined), validate goalId exists before operations, return 404 with helpful message if goal not found, return 500 with error details if operation fails, initialize empty state for new users.

STEP 3: Fix Worker API routes with comprehensive error handling
Rewrite index.ts (or main worker file) to add detailed logging at the START of each route, log the Durable Object stub creation, log before and after Durable Object calls, catch and log ALL errors with full details, add CORS headers properly, validate request bodies before processing, return detailed error messages (not just "internal error"). Apply this pattern to ALL routes.

STEP 4: Fix frontend API client with retry logic and detailed error messages
Rewrite api/client.ts to add detailed console.logs for every request, log request URL, method, headers, body, log response status and body, show user-friendly error messages in UI (use toast/alert), add loading states, handle network errors separately from API errors, add retry logic for 500 errors.

STEP 5: Fix React components with proper async handling
Update button handlers in components to add loading states (disabled during operations), show loading spinner/text, display success/error feedback, properly await async operations, refresh data after mutations, add try-catch around all async calls.

STEP 6: Ensure Durable Object binding is correct

STEP 7: Add CORS properly

STEP 8: Create a health check route

DELIVERABLES:
1. Complete UserStateDO.ts with full error handling and logging
2. Complete index.ts (worker) with all routes properly implemented
3. Complete api/client.ts with all API functions
4. Updated component files with proper button handlers
5. Fixed wrangler.toml
6. A debugging guide explaining how to check logs

Make EVERY file complete and production-ready. Add extensive console.log statements so I can see exactly where things are failing. Use proper TypeScript types throughout.
```

**Result**: Comprehensive debugging infrastructure was added, error handling was improved throughout the codebase, and all button interactions were fixed.

### Memory & State Requirement

```
also the study planner should be able to hold memory like before! or should have a state because that is waht is required of the project
```

**Result**: Documented that the application maintains both conversation memory (via Memory Durable Object) and study planner state (via UserStateDO Durable Object). See `MEMORY_STATE_DOCUMENTATION.md` for details.

---

## Summary

These prompts were given to Cursor sequentially, one phase at a time. Each phase built upon the previous one, ensuring a systematic and comprehensive development process. The prompts were designed to be:

1. **Specific**: Clear requirements for each component
2. **Incremental**: Each phase adds new functionality
3. **Complete**: Full specifications with examples
4. **Production-Ready**: Error handling, validation, and best practices emphasized

The final application is a fully functional, production-ready Agentic Study & Life Planner built on Cloudflare Workers with Durable Objects, featuring:

- ✅ Complete data models with helper functions
- ✅ Durable Object state management
- ✅ RESTful API with Hono routing
- ✅ AI-powered plan generation using Workers AI
- ✅ React frontend with TypeScript
- ✅ Calendar and memory visualization
- ✅ Command-based chat interface
- ✅ Comprehensive error handling
- ✅ Production deployment configuration
