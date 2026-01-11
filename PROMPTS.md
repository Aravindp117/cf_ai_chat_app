# PROMPTS.md

This document contains all the hypothetical prompts that could have been used to build the Agentic Study & Life Planner application from scratch. These prompts are organized by development phases and reflect a logical progression from initial concept to full implementation.

---

## Phase 1: Initial Setup & Architecture Planning

### Prompt 1.1: Project Setup
```
I'm building an Agentic Study & Life Planner application on Cloudflare Workers with Durable Objects. 
Set up the project structure:
- Backend: Cloudflare Worker with TypeScript
- Frontend: React with Vite and TypeScript
- Use Cloudflare Workers AI for LLM capabilities
- Set up proper folder structure for both frontend and backend
- Configure wrangler.json and package.json files
- Include Tailwind CSS for styling
```

### Prompt 1.2: Data Models & Type Definitions
```
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

---

## Phase 2: Backend Infrastructure

### Prompt 2.1: Durable Object Implementation
```
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
   - Handle race conditions properly
   - Return proper HTTP responses (200, 404, 400, etc.)
   - Include error handling

Put this in `src/durable-objects/UserStateDO.ts`. Also create `src/durable-objects/index.ts` that exports the Durable Object for Wrangler.

Make sure it follows Cloudflare Durable Objects best practices.
```

### Prompt 2.2: API Routes with Hono
```
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
   - Body: { topicId, goalId, durationMinutes, notes, date? }
   - Updates lastReviewed and reviewCount for the topic

6. `GET /api/plan/:date` - Get daily plan for date (YYYY-MM-DD)
   - If plan doesn't exist, return 404

7. `POST /api/plan/generate` - Generate today's plan using AI
   - Body: { date: string (optional, defaults to today) }
   - Calls LLM with user state
   - Stores generated plan
   - Returns: DailyPlan

8. `DELETE /api/plan/:date` - Delete daily plan

9. `GET /api/review` - Get topics needing review (sorted by urgency)

**Architecture**:
- Each route gets userId from a header or query param (auth can be added later)
- Each route gets the Durable Object stub via: `env.USER_STATE.get(env.USER_STATE.idFromName(userId))`
- Use proper HTTP status codes
- Include error handling and validation

Create this in `src/index.ts` with clean, modular code. Also update `wrangler.toml` to include the Durable Object binding.
```

### Prompt 2.3: AI Agent for Plan Generation
```
Create an AI agent module that generates intelligent daily plans using the Workers AI LLaMA model.

**File**: `src/agent/planner.ts`

**Function**: `generateDailyPlan(userState: UserState, targetDate: string, ai: Ai): Promise<DailyPlan>`

**Agent Logic**:
1. **Analyze user state** - Extract active goals, topics with decay status, recent sessions
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
   - **IMPORTANT**: Return ONLY valid JSON in this exact format:
     ```json
     {
       "tasks": [
         {
           "topicId": "topic-123",
           "goalId": "goal-456",
           "type": "review",
           "estimatedMinutes": 45,
           "priority": 5,
           "reasoning": "This topic hasn't been reviewed in 15 days (red decay)"
         }
       ],
       "reasoning": "Overall plan explanation..."
     }
     ```

4. **Call Workers AI**:
   - Use `@cf/meta/llama-3.1-8b-instruct` or `@cf/meta/llama-3-8b-instruct`
   - temperature: 0.7, max_tokens: 1500

5. **Parse LLM response**:
   - Extract JSON from response (handle markdown code blocks if present)
   - Validate tasks structure
   - Return DailyPlan object
   - Add retry logic and fallback plans

Also create `src/agent/prompts.ts` with prompt templates. Make sure to handle cases where LLaMA doesn't return perfect JSON (add retry logic or JSON extraction helpers).
```

---

## Phase 3: Frontend Foundation

### Prompt 3.1: React Frontend Setup
```
Create a React frontend (using Vite) with these components:

**Pages**:
1. `DashboardPage.tsx` - Main view showing today's plan, goals overview, urgent reviews
2. `GoalsPage.tsx` - List and manage goals
3. `CalendarPage.tsx` - Calendar view with planned tasks
4. `ChatPage.tsx` - Chat interface with command support

**Components**:
1. `GoalCard.tsx` - Display goal with deadline countdown, topics with decay colors
2. `DailyPlanView.tsx` - Show today's AI-generated plan with task list
3. `TopicDecayIndicator.tsx` - Visual indicator (green/yellow/orange/red dot or bar)
4. `StudySessionModal.tsx` - Form to log a completed study session
5. `CommandChat.tsx` - Chat with command parsing

**State Management**:
- Use React Context for global state
- Fetch data from Worker API
- Real-time updates after actions

**Styling**:
- Use Tailwind CSS
- Clean, student-friendly UI
- Mobile-responsive

Create these in `src/components/` and `src/pages/`. Include a `src/api/client.ts` with typed fetch helpers for all API routes.
```

### Prompt 3.2: Navigation & Routing
```
Set up React Router with the following:
- Routes: / (Dashboard), /goals, /calendar, /chat
- Sidebar/navigation bar with active route highlighting
- Navigation component with icons
- Proper route configuration in App.tsx
```

### Prompt 3.3: API Client & State Management
```
Create a comprehensive API client (`src/api/client.ts`) with:
- Typed fetch helpers for all backend routes
- Error handling
- User ID management (localStorage)
- Headers configuration

Set up React Context (`src/context/AppContext.tsx`) with:
- Global state for goals, todayPlan, reviewTopics
- Refresh functions
- Loading states
- Functions to add/remove daily plans
```

---

## Phase 4: Core Features

### Prompt 4.1: Goals Management
```
Implement the Goals page with:
- List of all active goals
- Create goal modal with form (title, type, deadline, priority, topics)
- Edit goal functionality
- Delete/archive goal functionality
- Goal cards showing:
  - Deadline countdown
  - Topics with memory decay indicators
  - Progress indicators
- Responsive grid layout
- Error handling and toast notifications
```

### Prompt 4.2: Study Session Logging
```
Create a StudySessionModal component that:
- Allows selecting a goal and topic
- Input for duration (minutes)
- Optional notes field
- Date picker (defaults to today, but can log past dates)
- On submit:
  - Calls POST /api/sessions
  - Updates topic's lastReviewed and reviewCount
  - Updates mastery level based on session duration
  - Refreshes the UI
- Shows success/error toasts
- Form validation
```

### Prompt 4.3: Daily Plan Generation & Display
```
Implement the DailyPlanView component:
- Shows today's AI-generated plan
- Display reasoning from AI
- List all tasks with:
  - Topic name
  - Type (study/review/project)
  - Estimated time
  - Priority
  - Reasoning
- "Generate Plan" button when no plan exists
- "Regenerate" button to create new plan
- "Delete Plan" button
- Loading states during generation
- Total time calculation
- Visual loading indicators (spinners) when generating
```

---

## Phase 5: Advanced Features

### Prompt 5.1: Calendar Component
```
Create a Calendar component (`src/components/Calendar.tsx`) with:

- Week view by default (expandable to month view)
- Display planned tasks as colored blocks in day cells
- Color by priority (red = high, yellow = medium, green = low)
- Click task to see details
- Click empty slot to add ad-hoc study session
- Month/year header display
- Navigation (prev/next week/month, "Today" button)
- When scrolling, only include days inside the current month
- Use `date-fns` for date manipulation
- Fetch plans via `GET /api/plan/:date` for each visible date
- Loading states for dates being fetched
- Selected date details panel showing full plan
- "Generate Plan" button for selected dates
- "Delete Plan" button (only for today and future dates)
- Show topic names in task displays
- Allow adding sessions even when plan exists
- Prevent adding sessions for future dates
- Visual loading indicators when generating plans
```

### Prompt 5.2: Memory Decay Visualization
```
Create a MemoryMatrix component (`src/components/MemoryMatrix.tsx`) that:

- Grid or list view of all topics across all goals
- Each topic shows:
  - Name
  - Goal it belongs to
  - Last reviewed date
  - Memory decay color (green < 3 days, yellow 3-7 days, orange 7-14 days, red > 14 days)
  - Review count
  - Next suggested review date (spaced repetition)
  - Mastery level
- Sort by urgency (red topics first)
- Click topic to log review session (opens StudySessionModal)
- Prominent "Log Session" button on each topic card
- View mode toggle (grid/list)
- Responsive layout
- Color-coded borders/backgrounds based on decay level
```

### Prompt 5.3: Helper Functions for Memory
```
Create helper functions in `src/utils/memory.ts`:
- `getDecayColor(lastReviewed: string | null, reviewCount: number): 'green' | 'yellow' | 'orange' | 'red'`
- `getNextReviewDate(lastReviewed: string, reviewCount: number): string` (spaced repetition)
- `getUrgencyScore(topic: Topic): number` (for sorting)
- `isDueForReview(topic: Topic): boolean`
- `getDaysUntilReview(topic: Topic): number`

Use `date-fns` for date calculations.
```

---

## Phase 6: Chat & Commands

### Prompt 6.1: Command Parser
```
Create a command parser utility (`src/utils/commands.ts`):
- Parse chat messages starting with `!`
- Extract command and arguments
- Return structured command object
- Handle errors gracefully
- Support commands: !today, !plan, !review, !goals, !add goal, !log
```

### Prompt 6.2: Chat Interface with Commands
```
Create a CommandChat component that:
- Send normal messages to LLM (conversational AI)
- Intercept commands starting with `!` and execute via API
- Display command results in chat
- Show AI-generated plan reasoning in chat
- Commands to implement:
  - `!today` → Shows today's plan
  - `!plan` → Generates new plan for today
  - `!review` → Shows topics needing review
  - `!goals` → Lists active goals
  - `!add goal [title]` → Creates new goal (follow-up prompts for details)
  - `!log [topicName] [minutes]` → Logs study session
- Chat history display
- Loading states
- Error handling
```

---

## Phase 7: Polish & Integration

### Prompt 7.1: Error Handling & User Feedback
```
Add comprehensive error handling:
- Try-catch to all API calls
- Show toast notifications for errors (use react-hot-toast)
- Add loading states to all async operations
- Handle offline gracefully
- Display user-friendly error messages
- Loading indicators for all async operations
```

### Prompt 7.2: Responsive Design & Accessibility
```
Ensure the application is:
- Fully responsive (mobile, tablet, desktop)
- Accessible (ARIA labels, keyboard navigation)
- Form fields have proper `id`, `name`, and `htmlFor` attributes
- Buttons don't overlap on small screens
- Navigation is mobile-friendly
- All interactive elements are properly sized for touch
```

### Prompt 7.3: Smart Plan Generation Logic
```
Update plan generation to be smarter:
- When generating today's plan, check if sessions were logged yesterday
- If no sessions yesterday AND plan exists → keep existing plan
- If sessions were logged yesterday → generate new plan based on progress
- This logic should be in the `/api/plan/generate` endpoint
```

### Prompt 7.4: Plan Management
```
Implement plan management features:
- Delete plans (only for today and future dates)
- Prevent deleting past plans
- When deleting, properly remove from UI and backend
- Visual loading states when deleting
- Proper state management to prevent deleted plans from reappearing
```

### Prompt 7.5: Mastery Calculation
```
Update mastery level calculation to be more realistic:
- Base increase: 20% for 1st review, 18% for 2nd, decreasing gradually
- Duration bonus: up to +8% for longer sessions (90+ minutes)
- Diminishing returns: effectiveness reduced at higher mastery levels
- Prevent unrealistic jumps from 95% to 100% in one session
- Minimum 1% progress per session
```

---

## Phase 8: Deployment

### Prompt 8.1: Deployment Configuration
```
Set up deployment:
- Cloudflare Pages for frontend
- Cloudflare Worker for backend
- Update `wrangler.toml` with production settings
- Create deployment scripts (PowerShell)
- Environment variables configuration
- Update README.md with setup and deployment instructions
```

### Prompt 8.2: Documentation
```
Create comprehensive documentation:
- README.md with:
  - Project overview
  - Setup instructions
  - API documentation
  - Deployment guide
  - Architecture overview
- Code comments where necessary
- Type definitions well-documented
```

---

## Additional Feature Prompts

### Prompt A.1: Session Date Selection
```
Add date selection to study session logging:
- Date input field in StudySessionModal
- Default to today's date
- Allow selecting past dates (for logging missed sessions)
- Prevent selecting future dates
- Pass selected date to backend API
```

### Prompt A.2: Task Deletion on Session Log
```
When a study session is logged, automatically remove the matching task from that day's plan:
- Match tasks by topicId and goalId
- Only remove tasks for the same date as the session
- Update the daily plan in storage
- Refresh UI to show updated plan
```

### Prompt A.3: Calendar Improvements
```
Improve calendar component:
- Show month name and year in header
- When in month view, dim days outside current month
- Week view shows only the 7 days of the current week
- Proper navigation for week and month views
- "Generate Plan" button works for any selected date
- Generated plans update immediately in calendar grid
- Topic names displayed in all task views
```

### Prompt A.4: Visual Loading States
```
Add visual loading indicators:
- Spinner animations when generating plans
- Loading state in calendar grid for dates being generated
- Loading state in selected date details panel
- Loading state in DailyPlanView when generating/regenerating
- Use animated bouncing dots (similar to chat loading)
- Show "Generating..." text with helpful messages
- Disable buttons during operations
```

---

## Summary

These prompts represent a comprehensive development journey from initial concept to a fully-featured study planner application. The prompts are organized to:

1. **Build incrementally** - Start with data models, then backend, then frontend
2. **Focus on user experience** - Each feature includes error handling, loading states, and responsive design
3. **Leverage AI capabilities** - Smart plan generation using Workers AI
4. **Maintain best practices** - TypeScript, proper error handling, accessibility
5. **Polish thoroughly** - Loading states, responsive design, proper state management

The application successfully combines:
- **Backend**: Cloudflare Workers, Durable Objects, Workers AI
- **Frontend**: React, TypeScript, Tailwind CSS, React Router
- **AI**: LLaMA models for intelligent plan generation
- **Features**: Goal management, session tracking, memory decay, calendar visualization, chat interface

