/**
 * Daily Plan View Component
 */

import { useState } from 'react';
import { DailyPlan, PlannedTask } from '../types';
import { useApp } from '../context/AppContext';
import { plansApi } from '../api/client';
import toast from 'react-hot-toast';

interface DailyPlanViewProps {
  plan: DailyPlan | null;
  onRefresh?: () => void;
}

export default function DailyPlanView({ plan, onRefresh }: DailyPlanViewProps) {
  const { refreshTodayPlan, addDailyPlan, removeDailyPlan, goals } = useApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper function to get topic name from task
  const getTopicName = (task: PlannedTask): string => {
    const goal = goals.find((g) => g.id === task.goalId);
    if (!goal) return 'Unknown Topic';
    const topic = goal.topics.find((t) => t.id === task.topicId);
    return topic?.name || 'Unknown Topic';
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const generatedPlan = await plansApi.generate(today);
      // Update context immediately so calendar grid shows the plan
      addDailyPlan(generatedPlan);
      refreshTodayPlan();
      if (onRefresh) onRefresh();
      toast.success('Plan generated successfully!');
    } catch (error: any) {
      console.error('Failed to generate plan:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate plan. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!plan) return;
    const today = new Date().toISOString().split('T')[0];
    
    // Only allow deleting today's plan
    if (plan.date !== today) {
      toast.error('Can only delete today\'s plan');
      return;
    }

    if (!confirm(`Are you sure you want to delete today's plan?`)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      await plansApi.delete(plan.date);
      toast.success('Plan deleted successfully');
      removeDailyPlan(plan.date);
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error('Failed to delete plan:', error);
      toast.error(error.message || 'Failed to delete plan. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!plan) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          No plan generated for today
        </p>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? 'Generating...' : 'Generate Today\'s Plan'}
        </button>
      </div>
    );
  }

  const totalMinutes = plan.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Today's Study Plan
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {new Date(plan.date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm sm:text-base font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete Plan'}
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm sm:text-base font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating...' : 'Regenerate'}
          </button>
        </div>
      </div>

      {plan.reasoning && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">{plan.reasoning}</p>
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Total Time: {totalHours > 0 ? `${totalHours}h ` : ''}
          {remainingMinutes > 0 ? `${remainingMinutes}m` : ''} ({plan.tasks.length} tasks)
        </p>
      </div>

      <div className="space-y-3">
        {plan.tasks.map((task, index) => {
          const taskTypeEmoji =
            task.type === 'review' ? '🔄' : task.type === 'study' ? '📚' : '💼';
          return (
            <div
              key={index}
              className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border-l-4 border-blue-500"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{taskTypeEmoji}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {getTopicName(task)}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {task.type}
                    </span>
                  </div>
                  {task.reasoning && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {task.reasoning}
                    </p>
                  )}
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {task.estimatedMinutes} min
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Priority: {'★'.repeat(task.priority)}
                    {'☆'.repeat(5 - task.priority)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

