/**
 * Data Models & Types for Agentic Study & Life Planner
 * Cloudflare Workers with Durable Objects
 */

// ============================================================================
// CORE DATA MODELS
// ============================================================================

/**
 * Goal Model - Represents a study goal, exam, project, or commitment
 */
export interface Goal {
  id: string;
  title: string;
  type: 'exam' | 'project' | 'commitment';
  deadline: string; // ISO date string
  priority: number; // 1-5 (5 = highest)
  topics: Topic[];
  status: 'active' | 'completed' | 'archived';
  createdAt: string; // ISO date string
}

/**
 * Topic Model - Represents a specific topic within a goal
 */
export interface Topic {
  id: string;
  goalId: string; // Foreign key to Goal
  name: string;
  lastReviewed: string | null; // ISO date string or null
  reviewCount: number;
  masteryLevel: number; // 0-100
  notes: string;
}

/**
 * StudySession Model - Represents a study session for a topic
 */
export interface StudySession {
  id: string;
  topicId: string; // Foreign key to Topic
  goalId: string; // Foreign key to Goal
  date: string; // ISO date string
  durationMinutes: number;
  notes: string;
}

/**
 * DailyPlan Model - Represents an AI-generated daily study plan
 */
export interface DailyPlan {
  date: string; // ISO date string
  generatedAt: string; // ISO date string
  tasks: PlannedTask[];
  reasoning: string; // AI's explanation for the plan
}

/**
 * PlannedTask Model - Represents a task within a daily plan
 */
export interface PlannedTask {
  topicId: string;
  goalId: string;
  type: 'study' | 'review' | 'project_work';
  estimatedMinutes: number;
  priority: number; // 1-5
  reasoning: string; // Why this task is included
}

/**
 * UserState Model - The complete state stored in a Durable Object
 */
export interface UserState {
  userId: string;
  goals: Goal[];
  sessions: StudySession[];
  dailyPlans: DailyPlan[];
  lastPlanGenerated: string | null; // ISO date string or null
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Memory decay level based on time since last review
 */
export type MemoryDecayLevel = 'green' | 'yellow' | 'orange' | 'red';

/**
 * Spaced repetition interval in days
 */
export type SpacedRepetitionInterval = 1 | 3 | 7 | 14 | 30;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculates memory decay level based on lastReviewed date
 * Uses spaced repetition intervals to determine urgency
 * 
 * @param lastReviewed - ISO date string or null if never reviewed
 * @param reviewCount - Number of times the topic has been reviewed
 * @returns Memory decay level: green (fresh) -> yellow -> orange -> red (urgent)
 */
export function calculateMemoryDecayLevel(
  lastReviewed: string | null,
  reviewCount: number
): MemoryDecayLevel {
  // If never reviewed, it's red (urgent)
  if (!lastReviewed) {
    return 'red';
  }

  const now = new Date();
  const lastReviewDate = new Date(lastReviewed);
  const daysSinceReview = Math.floor(
    (now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Get the appropriate spaced repetition interval for this review count
  const interval = getSpacedRepetitionInterval(reviewCount);

  // Green: within 50% of interval (e.g., within 1.5 days for 3-day interval)
  if (daysSinceReview < interval * 0.5) {
    return 'green';
  }

  // Yellow: within 100% of interval (e.g., within 3 days for 3-day interval)
  if (daysSinceReview < interval) {
    return 'yellow';
  }

  // Orange: within 150% of interval (e.g., within 4.5 days for 3-day interval)
  if (daysSinceReview < interval * 1.5) {
    return 'orange';
  }

  // Red: beyond 150% of interval (urgent review needed)
  return 'red';
}

/**
 * Calculates spaced repetition intervals based on review count
 * Uses exponential backoff: 1 day, 3 days, 7 days, 14 days, 30 days
 * 
 * @param reviewCount - Number of times the topic has been reviewed
 * @returns Spaced repetition interval in days
 */
export function getSpacedRepetitionInterval(
  reviewCount: number
): SpacedRepetitionInterval {
  // First review: 1 day
  if (reviewCount === 0) {
    return 1;
  }

  // Second review: 3 days
  if (reviewCount === 1) {
    return 3;
  }

  // Third review: 7 days
  if (reviewCount === 2) {
    return 7;
  }

  // Fourth review: 14 days
  if (reviewCount === 3) {
    return 14;
  }

  // Fifth+ review: 30 days (max interval)
  return 30;
}

/**
 * Calculates urgency score for a goal based on deadline and priority
 * Higher score = more urgent
 * 
 * @param deadline - ISO date string
 * @param priority - Priority level 1-5 (5 = highest)
 * @returns Urgency score (0-100, higher = more urgent)
 */
export function getUrgencyScore(deadline: string, priority: number): number {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const daysUntilDeadline = Math.floor(
    (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Base urgency from priority (0-50 points)
  const priorityScore = (priority / 5) * 50;

  // Time urgency (0-50 points)
  // More urgent as deadline approaches
  let timeScore = 0;

  if (daysUntilDeadline < 0) {
    // Overdue: maximum time urgency
    timeScore = 50;
  } else if (daysUntilDeadline <= 7) {
    // Within a week: high urgency (50 points)
    timeScore = 50;
  } else if (daysUntilDeadline <= 14) {
    // Within 2 weeks: medium-high urgency (40 points)
    timeScore = 40;
  } else if (daysUntilDeadline <= 30) {
    // Within a month: medium urgency (30 points)
    timeScore = 30;
  } else if (daysUntilDeadline <= 60) {
    // Within 2 months: low-medium urgency (20 points)
    timeScore = 20;
  } else {
    // More than 2 months: low urgency (10 points)
    timeScore = 10;
  }

  // Combine priority and time urgency
  return Math.min(100, Math.round(priorityScore + timeScore));
}

/**
 * Gets the next review date for a topic based on spaced repetition
 * 
 * @param lastReviewed - ISO date string or null
 * @param reviewCount - Number of times reviewed
 * @returns ISO date string for next review, or null if never reviewed
 */
export function getNextReviewDate(
  lastReviewed: string | null,
  reviewCount: number
): string | null {
  if (!lastReviewed) {
    return null;
  }

  const interval = getSpacedRepetitionInterval(reviewCount);
  const lastReviewDate = new Date(lastReviewed);
  const nextReviewDate = new Date(lastReviewDate);
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return nextReviewDate.toISOString();
}

/**
 * Checks if a topic is due for review
 * 
 * @param lastReviewed - ISO date string or null
 * @param reviewCount - Number of times reviewed
 * @returns true if topic is due for review
 */
export function isTopicDueForReview(
  lastReviewed: string | null,
  reviewCount: number
): boolean {
  if (!lastReviewed) {
    return true; // Never reviewed, so it's due
  }

  const nextReview = getNextReviewDate(lastReviewed, reviewCount);
  if (!nextReview) {
    return true;
  }

  const now = new Date();
  const nextReviewDate = new Date(nextReview);
  return now >= nextReviewDate;
}

/**
 * Calculates total study time for a goal across all sessions
 * 
 * @param goalId - Goal ID
 * @param sessions - Array of study sessions
 * @returns Total minutes studied for this goal
 */
export function getTotalStudyTimeForGoal(
  goalId: string,
  sessions: StudySession[]
): number {
  return sessions
    .filter((session) => session.goalId === goalId)
    .reduce((total, session) => total + session.durationMinutes, 0);
}

/**
 * Gets active goals (not completed or archived)
 * 
 * @param goals - Array of goals
 * @returns Array of active goals
 */
export function getActiveGoals(goals: Goal[]): Goal[] {
  return goals.filter((goal) => goal.status === 'active');
}

/**
 * Gets topics that are due for review
 * 
 * @param topics - Array of topics
 * @returns Array of topics that are due for review
 */
export function getTopicsDueForReview(topics: Topic[]): Topic[] {
  return topics.filter((topic) =>
    isTopicDueForReview(topic.lastReviewed, topic.reviewCount)
  );
}

/**
 * Sorts goals by urgency score (highest first)
 * 
 * @param goals - Array of goals
 * @returns Array of goals sorted by urgency
 */
export function sortGoalsByUrgency(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    const urgencyA = getUrgencyScore(a.deadline, a.priority);
    const urgencyB = getUrgencyScore(b.deadline, b.priority);
    return urgencyB - urgencyA; // Descending order
  });
}

/**
 * Gets the most urgent active goal
 * 
 * @param goals - Array of goals
 * @returns Most urgent active goal, or null if none
 */
export function getMostUrgentGoal(goals: Goal[]): Goal | null {
  const activeGoals = getActiveGoals(goals);
  if (activeGoals.length === 0) {
    return null;
  }

  const sorted = sortGoalsByUrgency(activeGoals);
  return sorted[0];
}

