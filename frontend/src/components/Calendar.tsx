/**
 * Calendar Component - Week/Month view with planned tasks
 */

import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, eachDayOfInterval, parseISO, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { useApp } from '../context/AppContext';
import { DailyPlan } from '../types';
import { plansApi } from '../api/client';
import StudySessionModal from './StudySessionModal';

interface CalendarProps {
  viewMode?: 'week' | 'month';
}

export default function Calendar({ viewMode: initialViewMode = 'week' }: CalendarProps) {
  const { dailyPlans } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>(initialViewMode);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [loadingDates, setLoadingDates] = useState<Set<string>>(new Set());
  const [loadedPlans, setLoadedPlans] = useState<Map<string, DailyPlan>>(new Map());

  // Load plans for visible dates
  useEffect(() => {
    const loadPlansForVisibleDates = async () => {
      const visibleDateObjects = getVisibleDates();
      const dates = visibleDateObjects.map((d) => d.date);
      const datesToLoad = dates.filter(
        (date) => !loadedPlans.has(date) && !loadingDates.has(date)
      );

      if (datesToLoad.length === 0) return;

      setLoadingDates((prev) => new Set([...prev, ...datesToLoad]));

      const planPromises = datesToLoad.map(async (date) => {
        try {
          const plan = await plansApi.get(date);
          return { date, plan };
        } catch (error) {
          console.error(`Failed to load plan for ${date}:`, error);
          return { date, plan: null };
        }
      });

      const results = await Promise.all(planPromises);
      setLoadedPlans((prev) => {
        const newMap = new Map(prev);
        results.forEach(({ date, plan }) => {
          if (plan) {
            newMap.set(date, plan);
          }
        });
        return newMap;
      });

      setLoadingDates((prev) => {
        const newSet = new Set(prev);
        datesToLoad.forEach((date) => newSet.delete(date));
        return newSet;
      });
    };

    loadPlansForVisibleDates();
  }, [currentDate, viewMode]);

  // Merge loaded plans with context plans
  const allPlans = new Map<string, DailyPlan>();
  dailyPlans.forEach((plan) => allPlans.set(plan.date, plan));
  loadedPlans.forEach((plan, date) => allPlans.set(date, plan));

  const getVisibleDates = (): Array<{ date: string; inMonth: boolean }> => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    if (viewMode === 'week') {
      // For week view, find the week that contains the first day of the current month
      // Start from Sunday of that week
      const weekStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const dates = eachDayOfInterval({
        start: weekStart,
        end: addDays(weekStart, 6),
      });
      
      // Return all 7 days, but mark which are in the current month
      return dates.map((date) => ({
        date: format(date, 'yyyy-MM-dd'),
        inMonth: isSameMonth(date, currentDate),
      }));
    } else {
      // Month view - show the calendar grid for the current month
      // Start from the first Sunday of the week containing month start
      const weekStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      // End on the last Saturday of the week containing month end
      const weekEnd = startOfWeek(monthEnd, { weekStartsOn: 0 });
      const lastSaturday = addDays(weekEnd, 6);
      
      const dates = eachDayOfInterval({
        start: weekStart,
        end: lastSaturday,
      });
      
      // Return all dates, marking which are in the current month
      return dates.map((date) => ({
        date: format(date, 'yyyy-MM-dd'),
        inMonth: isSameMonth(date, currentDate),
      }));
    }
  };

  const getPriorityColor = (priority: number): string => {
    if (priority >= 4) return 'bg-red-500';
    if (priority >= 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
  };

  const handleEmptySlotClick = (date: string) => {
    setSelectedDate(date);
    setShowSessionModal(true);
  };

  const visibleDates = getVisibleDates();
  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Study Calendar - {format(currentDate, 'MMMM yyyy')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Click a date to view or create a plan
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              Month
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (viewMode === 'week') {
                // Move back one week, but stay within month bounds
                const newDate = addDays(currentDate, -7);
                setCurrentDate(newDate);
              } else {
                // Move to previous month
                const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
                setCurrentDate(newDate);
              }
            }}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg"
          >
            ← Previous
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Today
          </button>
          <button
            onClick={() => {
              if (viewMode === 'week') {
                // Move forward one week, but stay within month bounds
                const newDate = addDays(currentDate, 7);
                setCurrentDate(newDate);
              } else {
                // Move to next month
                const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
                setCurrentDate(newDate);
              }
            }}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="text-center font-semibold text-gray-700 dark:text-gray-300 py-2"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {visibleDates.map(({ date: dateStr, inMonth }) => {
          const date = parseISO(dateStr);
          const plan = allPlans.get(dateStr);
          const isToday = dateStr === today;
          const isSelected = selectedDate === dateStr;
          const isLoading = loadingDates.has(dateStr);
          
          // Skip rendering if not in month (for cleaner display)
          if (!inMonth && viewMode === 'month') {
            return (
              <div
                key={dateStr}
                className="min-h-[120px] p-2 border rounded-lg border-gray-100 dark:border-gray-800 opacity-30"
              >
                <span className="text-sm text-gray-400 dark:text-gray-600">
                  {format(date, 'd')}
                </span>
              </div>
            );
          }

          return (
            <div
              key={dateStr}
              onClick={() => handleDateClick(dateStr)}
              className={`min-h-[120px] p-2 border rounded-lg cursor-pointer transition-all ${
                !inMonth
                  ? 'border-gray-100 dark:border-gray-800 opacity-50'
                  : isToday
                  ? 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              } ${isSelected ? 'ring-2 ring-blue-500' : ''} ${
                !plan && inMonth ? 'hover:bg-gray-50 dark:hover:bg-gray-700' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`text-sm font-medium ${
                    isToday
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {format(date, 'd')}
                </span>
                {isLoading && (
                  <span className="text-xs text-gray-500">Loading...</span>
                )}
              </div>

              {plan && plan.tasks.length > 0 ? (
                <div className="space-y-1">
                  {plan.tasks.slice(0, 3).map((task, index) => (
                    <div
                      key={index}
                      className={`${getPriorityColor(
                        task.priority
                      )} text-white text-xs p-1 rounded truncate`}
                      title={`${task.type}: ${task.estimatedMinutes}min (Priority ${task.priority})`}
                    >
                      {task.type === 'review' ? '🔄' : task.type === 'study' ? '📚' : '💼'}{' '}
                      {task.estimatedMinutes}m
                    </div>
                  ))}
                  {plan.tasks.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{plan.tasks.length - 3} more
                    </div>
                  )}
                </div>
              ) : inMonth ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEmptySlotClick(dateStr);
                  }}
                  className="w-full text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-1"
                >
                  + Add session
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Selected date details */}
      {selectedDate && allPlans.has(selectedDate) && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
          </h3>
          {allPlans.get(selectedDate) && (
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                {allPlans.get(selectedDate)!.reasoning}
              </p>
              <div className="space-y-2">
                {allPlans.get(selectedDate)!.tasks.map((task, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {task.type === 'review' ? '🔄 Review' : task.type === 'study' ? '📚 Study' : '💼 Project'}: {task.estimatedMinutes} min
                      </span>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{task.reasoning}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(task.priority)} text-white`}>
                      P{task.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showSessionModal && selectedDate && (
        <StudySessionModal
          isOpen={showSessionModal}
          onClose={() => {
            setShowSessionModal(false);
            setSelectedDate(null);
          }}
        />
      )}
    </div>
  );
}

