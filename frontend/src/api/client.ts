/**
 * API Client for Study Planner
 */

import { Goal, StudySession, DailyPlan, Topic } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'https://cf-ai-memchat-worker.aravindpillarisetty.workers.dev';

function getUserId(): string {
  const STORAGE_KEY = 'chat_user_id';
  let userId = localStorage.getItem(STORAGE_KEY);
  
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(STORAGE_KEY, userId);
  }
  
  return userId;
}

function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': getUserId(),
  };
}

// Goals API
export const goalsApi = {
  async create(goal: {
    title: string;
    type: 'exam' | 'project' | 'commitment';
    deadline: string;
    priority: number;
    topics?: string[];
  }): Promise<Goal> {
    const response = await fetch(`${API_URL}/api/goals`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(goal),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create goal' }));
      throw new Error(errorData.error || `Failed to create goal: ${response.statusText}`);
    }
    return response.json();
  },

  async getAll(): Promise<Goal[]> {
    const response = await fetch(`${API_URL}/api/goals?userId=${getUserId()}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch goals');
    return response.json();
  },

  async update(id: string, updates: Partial<Goal>): Promise<Goal> {
    const response = await fetch(`${API_URL}/api/goals/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update goal');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/goals/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete goal');
  },
};

// Sessions API
export const sessionsApi = {
  async create(session: {
    topicId: string;
    goalId: string;
    durationMinutes: number;
    notes?: string;
  }): Promise<StudySession> {
    const response = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(session),
    });
    if (!response.ok) throw new Error('Failed to create session');
    return response.json();
  },
};

// Plans API
export const plansApi = {
  async get(date: string): Promise<DailyPlan | null> {
    const response = await fetch(`${API_URL}/api/plan/${date}?userId=${getUserId()}`, {
      headers: getHeaders(),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Failed to fetch plan');
    return response.json();
  },

  async generate(date?: string): Promise<DailyPlan> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const response = await fetch(`${API_URL}/api/plan/generate?userId=${getUserId()}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ date: targetDate }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to generate plan' }));
      throw new Error(errorData.error || `Failed to generate plan: ${response.statusText}`);
    }
    return response.json();
  },
};

// Review API
export const reviewApi = {
  async getTopicsNeedingReview(): Promise<Topic[]> {
    const response = await fetch(`${API_URL}/api/review?userId=${getUserId()}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch review topics');
    return response.json();
  },
};

// Chat API
export const chatApi = {
  async sendMessage(message: string): Promise<{ reply: string }> {
    const response = await fetch(`${API_URL}/api/chat?userId=${getUserId()}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  },
};

