/**
 * Cloudflare Worker with Hono routing for Study Planner API
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { Memory } from "./memory";
import { UserStateDO } from "./durable-objects";
import { Goal, StudySession, DailyPlan, PlannedTask, Topic, calculateMemoryDecayLevel, UserState } from "./types";
import { generateDailyPlan } from "./agent";

interface Env {
  AI: any;
  MEM_CHAT: DurableObjectNamespace;
  USER_STATE: DurableObjectNamespace;
}

type Context = {
  Bindings: Env;
  Variables: {
    userId: string;
  };
};

const app = new Hono<Context>();

// CORS middleware
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "X-User-Id"],
}));

// Middleware to extract userId from header or query param
app.use("*", async (c, next) => {
  const userId = c.req.header("X-User-Id") || c.req.query("userId") || "default-user";
  c.set("userId", userId);
  await next();
});

// Helper function to get UserStateDO stub
function getUserStateDO(env: Env, userId: string) {
  const id = env.USER_STATE.idFromName(userId);
  return env.USER_STATE.get(id);
}

// Helper function to get Memory DO stub (for chat)
function getMemoryDO(env: Env, userId: string) {
  const id = env.MEM_CHAT.idFromName(userId);
  return env.MEM_CHAT.get(id);
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get("/", (c) => {
  return c.json({ 
    status: "ok", 
    message: "✅ Cloudflare AI Study Planner is running" 
  });
});

// ============================================================================
// CHAT API (with command detection)
// ============================================================================

/**
 * Command handlers for chat commands
 */
async function handleCommand(
  command: string,
  userId: string,
  env: Env
): Promise<{ reply: string; isCommand: boolean }> {
  const userStateStub = getUserStateDO(env, userId);
  const trimmedCommand = command.trim().toLowerCase();

  // !today or !plan - Generate today's plan
  if (trimmedCommand === "!today" || trimmedCommand === "!plan") {
    try {
      const date = new Date().toISOString().split("T")[0];
      
      // Check if plan exists
      const planResponse = await userStateStub.fetch(
        `https://internal/daily-plans/${date}`,
        { method: "GET" }
      );

      if (planResponse.status === 200) {
        const plan = await planResponse.json<DailyPlan>();
        const tasksSummary = plan.tasks
          .map(
            (t, i) =>
              `${i + 1}. ${t.type === "review" ? "🔄 Review" : t.type === "study" ? "📚 Study" : "💼 Project"}: ${t.estimatedMinutes} min (Priority: ${"★".repeat(t.priority)}${"☆".repeat(5 - t.priority)})`
          )
          .join("\n");

        return {
          reply: `📅 **Today's Study Plan** (${date})\n\n${plan.reasoning}\n\n**Tasks:**\n${tasksSummary}`,
          isCommand: true,
        };
      } else {
        // Generate new plan using AI agent module
        const stateResponse = await userStateStub.fetch("https://internal/state", {
          method: "GET",
        });
        
        if (stateResponse.status === 404) {
          return {
            reply: "❌ No user state found. Please create a goal first!",
            isCommand: true,
          };
        }

        const userState = await stateResponse.json<UserState>();

        try {
          // Use the AI agent to generate the plan
          const plan = await generateDailyPlan(userState, date, env.AI);

          // Store the plan
          const planResponse = await userStateStub.fetch("https://internal/daily-plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(plan),
          });

          if (planResponse.status !== 201) {
            throw new Error("Failed to store plan");
          }

          const tasksSummary = plan.tasks
            .map(
              (t, i) =>
                `${i + 1}. ${t.type === "review" ? "🔄 Review" : t.type === "study" ? "📚 Study" : "💼 Project"}: ${t.estimatedMinutes} min (Priority: ${"★".repeat(t.priority)}${"☆".repeat(5 - t.priority)})`
            )
            .join("\n");

          return {
            reply: `📅 **Generated Today's Study Plan** (${date})\n\n${plan.reasoning}\n\n**Tasks:**\n${tasksSummary}`,
            isCommand: true,
          };
        } catch (error: any) {
          console.error("Plan generation error:", error);
          return {
            reply: `❌ Error generating plan: ${error.message || "Unknown error"}`,
            isCommand: true,
          };
        }
      }
    } catch (err) {
      console.error("Plan generation error:", err);
      return {
        reply: "❌ Error generating plan. Please try again.",
        isCommand: true,
      };
    }
  }

  // !goals - List active goals
  if (trimmedCommand === "!goals") {
    try {
      const response = await userStateStub.fetch(
        "https://internal/goals/with-decay",
        { method: "GET" }
      );

      if (response.status === 404) {
        return {
          reply: "📚 You don't have any active goals yet. Create one to get started!",
          isCommand: true,
        };
      }

      const goals = await response.json<Array<Goal & { topicsWithDecay: any[] }>>();
      const activeGoals = goals.filter((g) => g.status === "active");

      if (activeGoals.length === 0) {
        return {
          reply: "📚 You don't have any active goals yet. Create one to get started!",
          isCommand: true,
        };
      }

      const goalsList = activeGoals
        .map((g, i) => {
          const daysUntil = Math.ceil(
            (new Date(g.deadline).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          );
          const urgency = daysUntil < 0 ? "🔴 Overdue" : daysUntil <= 7 ? "🟠 Urgent" : daysUntil <= 14 ? "🟡 Soon" : "🟢 Upcoming";
          
          return `${i + 1}. **${g.title}** (${g.type})\n   Priority: ${"★".repeat(g.priority)}${"☆".repeat(5 - g.priority)}\n   Deadline: ${g.deadline.split("T")[0]} (${daysUntil < 0 ? Math.abs(daysUntil) + " days overdue" : daysUntil + " days left"}) ${urgency}\n   Topics: ${g.topics.length}`;
        })
        .join("\n\n");

      return {
        reply: `📚 **Your Active Goals** (${activeGoals.length}):\n\n${goalsList}`,
        isCommand: true,
      };
    } catch (err) {
      console.error("Get goals error:", err);
      return {
        reply: "❌ Error fetching goals. Please try again.",
        isCommand: true,
      };
    }
  }

  // !review - Get topics needing review
  if (trimmedCommand === "!review") {
    try {
      const response = await userStateStub.fetch(
        "https://internal/topics/needing-review",
        { method: "GET" }
      );

      const topics = await response.json<Topic[]>();

      if (!topics || topics.length === 0) {
        return {
          reply: "✅ Great! No topics need review right now. Keep up the good work!",
          isCommand: true,
        };
      }

      const topicsList = topics
        .slice(0, 10)
        .map((t, i) => {
          const decayLevel = t.lastReviewed
            ? calculateMemoryDecayLevel(t.lastReviewed, t.reviewCount)
            : "red";
          const decayEmoji =
            decayLevel === "red"
              ? "🔴"
              : decayLevel === "orange"
              ? "🟠"
              : decayLevel === "yellow"
              ? "🟡"
              : "🟢";

          return `${i + 1}. ${decayEmoji} **${t.name}**\n   Mastery: ${t.masteryLevel}% | Reviews: ${t.reviewCount}${t.lastReviewed ? ` | Last: ${new Date(t.lastReviewed).toLocaleDateString()}` : ""}`;
        })
        .join("\n\n");

      return {
        reply: `🔄 **Topics Needing Review** (${topics.length}):\n\n${topicsList}${topics.length > 10 ? `\n\n...and ${topics.length - 10} more` : ""}`,
        isCommand: true,
      };
    } catch (err) {
      console.error("Get review topics error:", err);
      return {
        reply: "❌ Error fetching review topics. Please try again.",
        isCommand: true,
      };
    }
  }

  // !help - Show available commands
  if (trimmedCommand === "!help" || trimmedCommand === "!commands") {
    return {
      reply: `🤖 **Available Commands:**

\`!today\` or \`!plan\` - Show or generate today's study plan
\`!goals\` - List all your active goals
\`!review\` - Show topics that need review
\`!help\` - Show this help message

You can also chat normally with me about your studies!`,
      isCommand: true,
    };
  }

  // Not a recognized command
  return { reply: "", isCommand: false };
}

app.post("/api/chat", async (c) => {
  try {
    const { message } = await c.req.json<{ message: string }>();
    const userId = c.get("userId");

    if (!message || typeof message !== "string") {
      return c.json({ error: "`message` is required (string)" }, 400);
    }

    // Check for commands first
    const commandResult = await handleCommand(message, userId, c.env);

    if (commandResult.isCommand) {
      // Return command response directly
      return c.json({ reply: commandResult.reply });
    }

    // Not a command, pass through to conversational AI
    const stub = getMemoryDO(c.env, userId);
    const doResponse = await stub.fetch("https://internal/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await doResponse.json();
    return c.json(data, doResponse.status);
  } catch (err) {
    console.error("Chat error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================================================
// GOALS API
// ============================================================================

/**
 * POST /api/goals - Create new goal
 * Body: { title, type, deadline, priority, topics: string[] }
 */
app.post("/api/goals", async (c) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.json<{
      title: string;
      type: "exam" | "project" | "commitment";
      deadline: string;
      priority: number;
      topics?: string[];
    }>();

    // Validation
    if (!body.title || !body.type || !body.deadline || !body.priority) {
      return c.json(
        { error: "title, type, deadline, and priority are required" },
        400
      );
    }

    if (body.priority < 1 || body.priority > 5) {
      return c.json({ error: "priority must be between 1 and 5" }, 400);
    }

    // Prepare goal data (topics will be created in addGoal)
    const goalData = {
      title: body.title,
      type: body.type,
      deadline: body.deadline,
      priority: body.priority,
      topics: (body.topics || []).map((name) => ({
        name,
        lastReviewed: null,
        reviewCount: 0,
        masteryLevel: 0,
        notes: "",
      })),
      status: "active" as const,
    };

    const stub = getUserStateDO(c.env, userId);
    const response = await stub.fetch("https://internal/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(goalData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to create goal" }));
      return c.json({ error: errorData.error || "Failed to create goal" }, response.status);
    }

    const goal = await response.json<Goal>();
    return c.json(goal, response.status);
  } catch (err: any) {
    console.error("Create goal error:", err);
    return c.json({ error: err.message || "Internal server error" }, 500);
  }
});

/**
 * GET /api/goals - List all active goals with memory decay indicators
 */
app.get("/api/goals", async (c) => {
  try {
    const userId = c.get("userId");
    const stub = getUserStateDO(c.env, userId);

    const response = await stub.fetch("https://internal/goals/with-decay", {
      method: "GET",
    });

    if (response.status === 404) {
      return c.json({ goals: [] }, 200);
    }

    const goals = await response.json();
    return c.json(goals, response.status);
  } catch (err) {
    console.error("Get goals error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * PUT /api/goals/:id - Update goal
 * Body: Partial<Goal>
 */
app.put("/api/goals/:id", async (c) => {
  try {
    const userId = c.get("userId");
    const goalId = c.req.param("id");
    const updates = await c.req.json<Partial<Goal>>();

    const stub = getUserStateDO(c.env, userId);
    const response = await stub.fetch(`https://internal/goals/${goalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (response.status === 404) {
      return c.json({ error: "Goal not found" }, 404);
    }

    const goal = await response.json<Goal>();
    return c.json(goal, response.status);
  } catch (err) {
    console.error("Update goal error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * DELETE /api/goals/:id - Archive goal
 */
app.delete("/api/goals/:id", async (c) => {
  try {
    const userId = c.get("userId");
    const goalId = c.req.param("id");

    const stub = getUserStateDO(c.env, userId);
    const response = await stub.fetch(`https://internal/goals/${goalId}`, {
      method: "DELETE",
    });

    if (response.status === 404) {
      return c.json({ error: "Goal not found" }, 404);
    }

    return c.json({ success: true }, 200);
  } catch (err) {
    console.error("Delete goal error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================================================
// SESSIONS API
// ============================================================================

/**
 * POST /api/sessions - Record study session
 * Body: { topicId, goalId, durationMinutes, notes }
 */
app.post("/api/sessions", async (c) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.json<{
      topicId: string;
      goalId: string;
      durationMinutes: number;
      notes?: string;
    }>();

    // Validation
    if (!body.topicId || !body.goalId || body.durationMinutes === undefined) {
      return c.json(
        { error: "topicId, goalId, and durationMinutes are required" },
        400
      );
    }

    if (body.durationMinutes < 0) {
      return c.json({ error: "durationMinutes must be non-negative" }, 400);
    }

    const sessionData: Omit<StudySession, "id"> = {
      topicId: body.topicId,
      goalId: body.goalId,
      date: new Date().toISOString(),
      durationMinutes: body.durationMinutes,
      notes: body.notes || "",
    };

    const stub = getUserStateDO(c.env, userId);
    const response = await stub.fetch("https://internal/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionData),
    });

    if (response.status === 400) {
      const error = await response.json();
      return c.json(error, 400);
    }

    const session = await response.json<StudySession>();
    return c.json(session, response.status);
  } catch (err) {
    console.error("Record session error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================================================
// DAILY PLAN API
// ============================================================================

/**
 * GET /api/plan/:date - Get daily plan for date (YYYY-MM-DD)
 */
app.get("/api/plan/:date", async (c) => {
  try {
    const userId = c.get("userId");
    const date = c.req.param("date");

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ error: "Invalid date format. Use YYYY-MM-DD" }, 400);
    }

    const stub = getUserStateDO(c.env, userId);
    const response = await stub.fetch(`https://internal/daily-plans/${date}`, {
      method: "GET",
    });

    if (response.status === 404) {
      return c.json({ error: "Plan not found for this date" }, 404);
    }

    const plan = await response.json<DailyPlan>();
    return c.json(plan, response.status);
  } catch (err) {
    console.error("Get plan error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * POST /api/plan/generate - Generate today's plan using AI
 * Body: { date?: string (optional, defaults to today) }
 */
app.post("/api/plan/generate", async (c) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.json<{ date?: string }>();
    const date = body.date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ error: "Invalid date format. Use YYYY-MM-DD" }, 400);
    }

    const stub = getUserStateDO(c.env, userId);

    // Get current user state
    const stateResponse = await stub.fetch("https://internal/state", {
      method: "GET",
    });

    if (stateResponse.status === 404) {
      return c.json({ error: "User state not found. Create a goal first." }, 404);
    }

    const userState = await stateResponse.json<UserState>();

    // Use AI agent to generate plan
    const plan = await generateDailyPlan(userState, date, c.env.AI);

    // Store the plan
    const planResponse = await stub.fetch("https://internal/daily-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plan),
    });

    if (planResponse.status !== 201) {
      const error = await planResponse.json();
      return c.json(error, planResponse.status);
    }

    const storedPlan = await planResponse.json<DailyPlan>();
    return c.json(storedPlan, 201);
  } catch (err) {
    console.error("Generate plan error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================================================
// REVIEW API
// ============================================================================

/**
 * GET /api/review - Get topics needing review (sorted by urgency)
 */
app.get("/api/review", async (c) => {
  try {
    const userId = c.get("userId");
    const asOfDate = c.req.query("asOfDate");

    const stub = getUserStateDO(c.env, userId);
    const url = asOfDate
      ? `https://internal/topics/needing-review?asOfDate=${asOfDate}`
      : "https://internal/topics/needing-review";

    const response = await stub.fetch(url, { method: "GET" });
    const topics = await response.json();
    return c.json(topics, response.status);
  } catch (err) {
    console.error("Get review topics error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================================================
// EXPORT
// ============================================================================

export default app;

// Required so Wrangler can bind the Durable Objects
export { Memory };
export { UserStateDO };
