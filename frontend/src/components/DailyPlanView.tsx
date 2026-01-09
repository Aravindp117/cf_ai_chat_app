/**
 * Daily Plan View Component
 */

import { DailyPlan } from '../types';
import { useApp } from '../context/AppContext';
import { plansApi } from '../api/client';

interface DailyPlanViewProps {
  plan: DailyPlan | null;
  onRefresh?: () => void;
}

export default function DailyPlanView({ plan, onRefresh }: DailyPlanViewProps) {
  const { refreshTodayPlan } = useApp();

  const handleGenerate = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const generatedPlan = await plansApi.generate(today);
      refreshTodayPlan();
      if (onRefresh) onRefresh();
      console.log('Plan generated successfully:', generatedPlan);
    } catch (error) {
      console.error('Failed to generate plan:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate plan. Please try again.';
      alert(errorMessage);
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
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Generate Today's Plan
        </button>
      </div>
    );
  }

  const totalMinutes = plan.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Today's Study Plan
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {new Date(plan.date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Regenerate
        </button>
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
                      Task {index + 1}
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

