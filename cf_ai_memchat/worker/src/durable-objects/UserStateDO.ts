/**
 * UserStateDO - Durable Object for managing user study planner state
 * Implements CRUD operations for goals, topics, sessions, and daily plans
 */

import {
  UserState,
  Goal,
  Topic,
  StudySession,
  DailyPlan,
  PlannedTask,
  calculateMemoryDecayLevel,
  isTopicDueForReview,
  getUrgencyScore,
} from "../types";

interface Env {
  // Add any environment bindings here if needed
}

interface GoalWithDecay extends Goal {
  topicsWithDecay: Array<Topic & { decayLevel: string }>;
}

export class UserStateDO {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /**
   * Retrieves the current user state from storage
   * Creates default state if none exists
   */
  async getState(): Promise<UserState> {
    const stored = await this.state.storage.get<UserState>("userState");
    if (stored) {
      return stored;
    }

    // Create default state
    const defaultState: UserState = {
      userId: this.state.id.toString(),
      goals: [],
      sessions: [],
      dailyPlans: [],
      lastPlanGenerated: null,
    };

    // Save default state
    await this.setState(defaultState);
    return defaultState;
  }

  /**
   * Saves user state to storage
   * Note: ctx.waitUntil is only available during request handling
   * Since we await the promise anyway, we don't strictly need waitUntil
   */
  async setState(userState: UserState): Promise<void> {
    await this.state.storage.put("userState", userState);
  }

  /**
   * Generates a unique ID for new entities
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Adds a new goal to the user state
   * Accepts topics without id and goalId - these will be generated
   */
  async addGoal(goalData: Omit<Goal, "id" | "createdAt"> & { topics: Omit<Topic, "id" | "goalId">[] }): Promise<Goal> {
    try {
      const state = await this.getState();

      const goalId = this.generateId();
      
      // Create Topic objects with IDs and goalId - ensure all required fields are present
      const topics: Topic[] = (goalData.topics || []).map((topicData) => ({
        id: this.generateId(),
        goalId: goalId,
        name: topicData.name || "",
        lastReviewed: topicData.lastReviewed ?? null,
        reviewCount: topicData.reviewCount ?? 0,
        masteryLevel: topicData.masteryLevel ?? 0,
        notes: topicData.notes || "",
      }));

      // Validate required fields
      if (!goalData.title || !goalData.type || !goalData.deadline || goalData.priority === undefined) {
        throw new Error("Missing required fields: title, type, deadline, or priority");
      }

      const newGoal: Goal = {
        id: goalId,
        title: goalData.title,
        type: goalData.type,
        deadline: goalData.deadline,
        priority: goalData.priority,
        status: goalData.status || "active",
        createdAt: new Date().toISOString(),
        topics,
      };

      state.goals.push(newGoal);
      await this.setState(state);

      console.log("Successfully created goal:", newGoal.id);
      return newGoal;
    } catch (error: any) {
      console.error("Error in addGoal:", error);
      throw error;
    }
  }

  /**
   * Updates an existing goal
   */
  async updateGoal(goalId: string, updates: Partial<Goal>): Promise<Goal> {
    const state = await this.getState();
    const goalIndex = state.goals.findIndex((g) => g.id === goalId);

    if (goalIndex === -1) {
      throw new Error(`Goal with id ${goalId} not found`);
    }

    // Merge updates, preserving id and createdAt
    const updatedGoal: Goal = {
      ...state.goals[goalIndex],
      ...updates,
      id: state.goals[goalIndex].id, // Preserve id
      createdAt: state.goals[goalIndex].createdAt, // Preserve createdAt
    };

    state.goals[goalIndex] = updatedGoal;
    await this.setState(state);

    return updatedGoal;
  }

  /**
   * Deletes a goal and all its associated topics
   */
  async deleteGoal(goalId: string): Promise<void> {
    const state = await this.getState();
    const trimmedGoalId = goalId.trim();

    console.log("deleteGoal: Looking for goal with id:", JSON.stringify(trimmedGoalId));
    console.log("deleteGoal: Available goal IDs:", state.goals.map(g => JSON.stringify(g.id)).join(", ") || "none");
    console.log("deleteGoal: Total goals:", state.goals.length);

    const goalIndex = state.goals.findIndex((g) => {
      return g.id === trimmedGoalId || g.id === goalId || g.id.trim() === trimmedGoalId;
    });

    if (goalIndex === -1) {
      const errorMsg = `Goal with id "${trimmedGoalId}" not found. Available goals: ${state.goals.map(g => `"${g.id}"`).join(", ") || "none"}`;
      console.error("deleteGoal:", errorMsg);
      throw new Error(errorMsg);
    }

    console.log("deleteGoal: Found matching goal at index", goalIndex, "with id:", JSON.stringify(state.goals[goalIndex].id));

    // Remove goal
    state.goals.splice(goalIndex, 1);

    // Remove sessions associated with this goal
    state.sessions = state.sessions.filter((s) => s.goalId !== trimmedGoalId && s.goalId !== goalId);

    // Remove tasks from daily plans that reference this goal
    state.dailyPlans = state.dailyPlans.map((plan) => ({
      ...plan,
      tasks: plan.tasks.filter((task) => task.goalId !== trimmedGoalId && task.goalId !== goalId),
    }));

    await this.setState(state);
    console.log("deleteGoal: Successfully deleted goal:", trimmedGoalId);
  }

  /**
   * Adds a topic to a goal
   */
  async addTopic(
    goalId: string,
    topicData: Omit<Topic, "id" | "goalId">
  ): Promise<Topic> {
    const state = await this.getState();
    const goal = state.goals.find((g) => g.id === goalId);

    if (!goal) {
      throw new Error(`Goal with id ${goalId} not found`);
    }

    const newTopic: Topic = {
      ...topicData,
      id: this.generateId(),
      goalId: goalId,
    };

    goal.topics.push(newTopic);
    await this.setState(state);

    return newTopic;
  }

  /**
   * Records a study session
   */
  async recordSession(
    sessionData: Omit<StudySession, "id">
  ): Promise<StudySession> {
    const state = await this.getState();

    // Validate goal and topic exist
    const goal = state.goals.find((g) => g.id === sessionData.goalId);
    if (!goal) {
      throw new Error(`Goal with id ${sessionData.goalId} not found`);
    }

    const topic = goal.topics.find((t) => t.id === sessionData.topicId);
    if (!topic) {
      throw new Error(
        `Topic with id ${sessionData.topicId} not found in goal ${sessionData.goalId}`
      );
    }

    const newSession: StudySession = {
      ...sessionData,
      id: this.generateId(),
    };

    state.sessions.push(newSession);

    // Update topic's lastReviewed and reviewCount
    topic.lastReviewed = sessionData.date;
    topic.reviewCount += 1;

    // More realistic mastery level calculation
    // Factors:
    // 1. Review count (diminishing returns - early reviews matter more)
    // 2. Session duration (longer sessions = more mastery)
    // 3. Current mastery level (harder to improve when already high)
    
    let baseIncrease = 0;
    
    // Base increase based on review count (early reviews give more mastery)
    // This creates a realistic progression where initial reviews are very effective
    if (topic.reviewCount === 1) {
      // First review: significant boost (20%)
      baseIncrease = 20;
    } else if (topic.reviewCount === 2) {
      // Second review: still very effective (18%)
      baseIncrease = 18;
    } else if (topic.reviewCount <= 5) {
      // Reviews 3-5: good increase (12-15%)
      baseIncrease = 12 + (5 - topic.reviewCount); // 15% for 3rd, 14% for 4th, 12% for 5th
    } else if (topic.reviewCount <= 10) {
      // Reviews 6-10: moderate increase (8-11%)
      baseIncrease = 8 + Math.floor((10 - topic.reviewCount) * 0.6); // Decreasing from 11% to 8%
    } else if (topic.reviewCount <= 20) {
      // Reviews 11-20: smaller increase (5-7%)
      baseIncrease = 5 + Math.floor((20 - topic.reviewCount) * 0.2); // Decreasing from 7% to 5%
    } else {
      // After 20 reviews: minimal but consistent increase (3-5%)
      baseIncrease = 3 + Math.floor((topic.reviewCount <= 30 ? 30 - topic.reviewCount : 0) * 0.2);
      baseIncrease = Math.max(3, baseIncrease); // Never below 3%
    }
    
    // Adjust based on session duration (longer sessions help more)
    // This encourages thorough study sessions
    let durationBonus = 0;
    if (sessionData.durationMinutes >= 90) {
      durationBonus = 8; // +8% for 90+ minute sessions
    } else if (sessionData.durationMinutes >= 60) {
      durationBonus = 5; // +5% for 60-89 minute sessions
    } else if (sessionData.durationMinutes >= 45) {
      durationBonus = 3; // +3% for 45-59 minute sessions
    } else if (sessionData.durationMinutes >= 30) {
      durationBonus = 1; // +1% for 30-44 minute sessions
    }
    // Below 30 minutes: no bonus (minimum effort threshold)
    
    let masteryIncrease = baseIncrease + durationBonus;
    
    // Diminishing returns: harder to improve when already high mastery
    // This prevents unrealistic jumps from 95% to 100% in one session
    if (topic.masteryLevel >= 95) {
      masteryIncrease = Math.floor(masteryIncrease * 0.2); // 20% effectiveness at 95%+
    } else if (topic.masteryLevel >= 85) {
      masteryIncrease = Math.floor(masteryIncrease * 0.4); // 40% effectiveness at 85-94%
    } else if (topic.masteryLevel >= 70) {
      masteryIncrease = Math.floor(masteryIncrease * 0.6); // 60% effectiveness at 70-84%
    } else if (topic.masteryLevel >= 50) {
      masteryIncrease = Math.floor(masteryIncrease * 0.8); // 80% effectiveness at 50-69%
    }
    // Below 50%: full effectiveness (100%)
    
    // Ensure we always make some progress (minimum 1%) and cap at 100%
    topic.masteryLevel = Math.min(100, topic.masteryLevel + Math.max(1, masteryIncrease));

    // Remove matching tasks from daily plans
    // Match by topicId and goalId for the same date as the session
    const sessionDate = sessionData.date.split('T')[0]; // Get YYYY-MM-DD
    state.dailyPlans = state.dailyPlans.map((plan) => {
      if (plan.date === sessionDate) {
        // Filter out tasks that match this session's topicId and goalId
        const remainingTasks = plan.tasks.filter(
          (task) => !(task.topicId === sessionData.topicId && task.goalId === sessionData.goalId)
        );
        return {
          ...plan,
          tasks: remainingTasks,
        };
      }
      return plan;
    });

    await this.setState(state);

    return newSession;
  }

  /**
   * Gets topics that need review, sorted by urgency
   */
  async getTopicsNeedingReview(asOfDate?: string): Promise<Topic[]> {
    const state = await this.getState();
    const checkDate = asOfDate ? new Date(asOfDate) : new Date();

    // Collect all topics from active goals
    const allTopics: Array<Topic & { urgency: number }> = [];
    for (const goal of state.goals) {
      if (goal.status === "active") {
        for (const topic of goal.topics) {
          if (isTopicDueForReview(topic.lastReviewed, topic.reviewCount)) {
            // Calculate urgency: higher decay level = higher urgency
            const decayLevel = calculateMemoryDecayLevel(
              topic.lastReviewed,
              topic.reviewCount
            );
            const urgencyMap = { red: 4, orange: 3, yellow: 2, green: 1 };
            const goalUrgency = getUrgencyScore(goal.deadline, goal.priority);

            // Combined urgency: decay level + goal urgency
            allTopics.push({
              ...topic,
              urgency: urgencyMap[decayLevel] * 20 + goalUrgency * 0.2,
            });
          }
        }
      }
    }

    // Sort by urgency (highest first)
    return allTopics
      .sort((a, b) => b.urgency - a.urgency)
      .map(({ urgency, ...topic }) => topic);
  }

  /**
   * Generates and stores a daily plan
   */
  async generateDailyPlan(
    date: string,
    aiReasoning: string,
    tasks: PlannedTask[]
  ): Promise<DailyPlan> {
    const state = await this.getState();

    // Validate that all tasks reference valid goals and topics
    for (const task of tasks) {
      const goal = state.goals.find((g) => g.id === task.goalId);
      if (!goal) {
        throw new Error(`Goal with id ${task.goalId} not found`);
      }
      const topic = goal.topics.find((t) => t.id === task.topicId);
      if (!topic) {
        throw new Error(
          `Topic with id ${task.topicId} not found in goal ${task.goalId}`
        );
      }
    }

    const newPlan: DailyPlan = {
      date: date,
      generatedAt: new Date().toISOString(),
      tasks: tasks,
      reasoning: aiReasoning,
    };

    // Remove existing plan for this date if it exists
    state.dailyPlans = state.dailyPlans.filter((p) => p.date !== date);
    state.dailyPlans.push(newPlan);
    state.lastPlanGenerated = new Date().toISOString();

    await this.setState(state);

    return newPlan;
  }

  /**
   * Retrieves a daily plan for a specific date
   */
  async getDailyPlan(date: string): Promise<DailyPlan | null> {
    const state = await this.getState();
    const plan = state.dailyPlans.find((p) => p.date === date);
    return plan || null;
  }

  /**
   * Gets all goals with memory decay information for each topic
   */
  async getGoalsWithDecay(): Promise<GoalWithDecay[]> {
    const state = await this.getState();

    return state.goals.map((goal) => ({
      ...goal,
      topicsWithDecay: goal.topics.map((topic) => ({
        ...topic,
        decayLevel: calculateMemoryDecayLevel(
          topic.lastReviewed,
          topic.reviewCount
        ),
      })),
    }));
  }

  /**
   * Main fetch handler for HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // CORS headers
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

      // Handle CORS preflight
      if (method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // GET /state - Get full user state
      if (path === "/state" && method === "GET") {
        const state = await this.getState();
        return new Response(JSON.stringify(state), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // PUT /state - Update full user state
      if (path === "/state" && method === "PUT") {
        const body = await request.json();
        await this.setState(body as UserState);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // POST /goals - Add a new goal
      if (path === "/goals" && method === "POST") {
        try {
          const body = await request.json();
          console.log("Durable Object: Received create goal request:", JSON.stringify(body));
          
          // Validate required fields before calling addGoal
          if (!body.title || typeof body.title !== "string") {
            return new Response(
              JSON.stringify({ error: "Title is required and must be a string" }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          const goal = await this.addGoal(body);
          console.log("Durable Object: Successfully created goal:", goal.id);
          return new Response(JSON.stringify(goal), {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error: any) {
          console.error("Durable Object: Error in addGoal:", error);
          console.error("Durable Object: Error stack:", error.stack);
          return new Response(
            JSON.stringify({ error: error.message || "Failed to create goal" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // PUT /goals/:id - Update a goal
      if (path.startsWith("/goals/") && method === "PUT") {
        const goalId = path.split("/goals/")[1];
        const body = await request.json();
        try {
          const goal = await this.updateGoal(goalId, body);
          return new Response(JSON.stringify(goal), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error: any) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // DELETE /goals/:id - Delete a goal
      // Must check DELETE before POST /goals/:id/topics to avoid path conflicts
      if (path.startsWith("/goals/") && method === "DELETE" && !path.includes("/topics")) {
        // Extract and decode goalId from path
        const rawGoalId = path.replace("/goals/", "").split("/")[0];
        const goalId = decodeURIComponent(rawGoalId).trim(); // URL decode and trim
        if (!goalId) {
          return new Response(
            JSON.stringify({ error: "Goal ID required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        try {
          console.log("Durable Object: DELETE route - path:", path, "raw goalId:", rawGoalId, "decoded goalId:", JSON.stringify(goalId));
          await this.deleteGoal(goalId);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error: any) {
          console.error("Durable Object: Error deleting goal:", error);
          console.error("Durable Object: Error stack:", error.stack);
          return new Response(
            JSON.stringify({ error: error.message || "Failed to delete goal" }),
            {
              status: error.message && error.message.includes("not found") ? 404 : 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // POST /goals/:id/topics - Add a topic to a goal
      if (path.includes("/topics") && method === "POST") {
        const goalId = path.split("/goals/")[1]?.split("/topics")[0];
        if (!goalId) {
          return new Response(
            JSON.stringify({ error: "Goal ID required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        const body = await request.json();
        try {
          const topic = await this.addTopic(goalId, body);
          return new Response(JSON.stringify(topic), {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error: any) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // POST /sessions - Record a study session
      if (path === "/sessions" && method === "POST") {
        const body = await request.json();
        try {
          const session = await this.recordSession(body);
          return new Response(JSON.stringify(session), {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error: any) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // GET /topics/needing-review - Get topics that need review
      if (path === "/topics/needing-review" && method === "GET") {
        const asOfDate = url.searchParams.get("asOfDate") || undefined;
        const topics = await this.getTopicsNeedingReview(asOfDate);
        return new Response(JSON.stringify(topics), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // POST /daily-plans - Generate a daily plan
      if (path === "/daily-plans" && method === "POST") {
        const body = await request.json();
        const { date, reasoning, tasks } = body;
        if (!date || !reasoning || !tasks) {
          return new Response(
            JSON.stringify({
              error: "date, reasoning, and tasks are required",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        try {
          const plan = await this.generateDailyPlan(date, reasoning, tasks);
          return new Response(JSON.stringify(plan), {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error: any) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // GET /daily-plans/:date - Get a daily plan
      if (path.startsWith("/daily-plans/") && method === "GET") {
        const date = path.split("/daily-plans/")[1];
        const plan = await this.getDailyPlan(date);
        if (!plan) {
          return new Response(
            JSON.stringify({ error: "Plan not found" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        return new Response(JSON.stringify(plan), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // GET /goals/with-decay - Get goals with decay information
      if (path === "/goals/with-decay" && method === "GET") {
        const goals = await this.getGoalsWithDecay();
        console.log("Durable Object: GET /goals/with-decay - Returning", goals.length, "goals");
        console.log("Durable Object: Goal IDs:", goals.map(g => g.id));
        return new Response(JSON.stringify(goals), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 404 for unknown routes
      return new Response(
        JSON.stringify({ error: "Not Found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (error: any) {
      console.error("UserStateDO error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error", message: error.message }),
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }
  }
}

