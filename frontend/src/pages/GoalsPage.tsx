/**
 * Goals Page - List and manage goals
 */

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import GoalCard from '../components/GoalCard';
import { goalsApi } from '../api/client';

export default function GoalsPage() {
  const { goals, loading, refreshAll } = useApp();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    type: 'exam' as 'exam' | 'project' | 'commitment',
    deadline: '',
    priority: 3,
    topics: '',
  });

  const activeGoals = goals.filter((g) => g.status === 'active');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const topics = formData.topics
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      // Convert date to ISO string
      // HTML date input returns YYYY-MM-DD format
      let deadlineISO = '';
      if (formData.deadline) {
        try {
          // Handle YYYY-MM-DD format from HTML date input
          const dateStr = formData.deadline.includes('T') 
            ? formData.deadline.split('T')[0] 
            : formData.deadline;
          const date = new Date(dateStr + 'T00:00:00.000Z');
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
          }
          deadlineISO = date.toISOString();
        } catch (error) {
          console.error('Date conversion error:', error);
          alert('Invalid date format. Please select a valid deadline.');
          return;
        }
      }

      if (!deadlineISO) {
        alert('Please select a deadline');
        return;
      }

      await goalsApi.create({
        title: formData.title,
        type: formData.type,
        deadline: deadlineISO,
        priority: formData.priority,
        topics,
      });

      setShowCreateModal(false);
      setFormData({
        title: '',
        type: 'exam',
        deadline: '',
        priority: 3,
        topics: '',
      });
      refreshAll();
    } catch (error) {
      console.error('Failed to create goal:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create goal. Please try again.';
      alert(errorMessage);
    }
  };

  const handleDelete = async (goalId: string) => {
    if (confirm('Are you sure you want to delete this goal?')) {
      try {
        await goalsApi.delete(goalId);
        refreshAll();
      } catch (error) {
        console.error('Failed to delete goal:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete goal. Please try again.';
        alert(errorMessage);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              My Goals
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Manage your study goals and track progress
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm sm:text-base whitespace-nowrap flex-shrink-0 self-start sm:self-auto"
          >
            + New Goal
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
            Active Goals ({activeGoals.length})
          </h2>
        </div>

        {activeGoals.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {activeGoals.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 sm:p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No active goals yet. Create your first goal to get started!
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
            >
              Create Goal
            </button>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Create New Goal
              </h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label htmlFor="goal-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    id="goal-title"
                    name="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="goal-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type
                  </label>
                  <select
                    id="goal-type"
                    name="type"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as 'exam' | 'project' | 'commitment',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="exam">Exam</option>
                    <option value="project">Project</option>
                    <option value="commitment">Commitment</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="goal-deadline" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Deadline
                  </label>
                  <input
                    id="goal-deadline"
                    name="deadline"
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="goal-priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Priority (1-5)
                  </label>
                  <input
                    id="goal-priority"
                    name="priority"
                    type="number"
                    min="1"
                    max="5"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="goal-topics" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Topics (comma-separated)
                  </label>
                  <input
                    id="goal-topics"
                    name="topics"
                    type="text"
                    value={formData.topics}
                    onChange={(e) => setFormData({ ...formData, topics: e.target.value })}
                    placeholder="e.g., Algebra, Calculus, Statistics"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

