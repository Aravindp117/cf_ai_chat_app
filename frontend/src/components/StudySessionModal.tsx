/**
 * Study Session Modal Component
 */

import { useState, useEffect } from 'react';
import { Goal, Topic } from '../types';
import { sessionsApi } from '../api/client';
import { useApp } from '../context/AppContext';

interface StudySessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal?: Goal;
  topic?: Topic;
}

export default function StudySessionModal({
  isOpen,
  onClose,
  goal,
  topic,
}: StudySessionModalProps) {
  const { goals, refreshAll } = useApp();
  const [selectedGoalId, setSelectedGoalId] = useState(goal?.id || '');
  const [selectedTopicId, setSelectedTopicId] = useState(topic?.id || '');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (goal) setSelectedGoalId(goal.id);
    if (topic) setSelectedTopicId(topic.id);
  }, [goal, topic]);

  const selectedGoal = goals.find((g) => g.id === selectedGoalId);
  const availableTopics = selectedGoal?.topics || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalId || !selectedTopicId) {
      alert('Please select a goal and topic');
      return;
    }

    try {
      await sessionsApi.create({
        goalId: selectedGoalId,
        topicId: selectedTopicId,
        durationMinutes,
        notes,
      });
      refreshAll();
      onClose();
      setNotes('');
      setDurationMinutes(30);
    } catch (error) {
      console.error('Failed to log session:', error);
      alert('Failed to log session. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Log Study Session
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="session-goal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Goal
            </label>
            <select
              id="session-goal"
              name="goalId"
              value={selectedGoalId}
              onChange={(e) => {
                setSelectedGoalId(e.target.value);
                setSelectedTopicId('');
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="">Select a goal</option>
              {goals
                .filter((g) => g.status === 'active')
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label htmlFor="session-topic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Topic
            </label>
            <select
              id="session-topic"
              name="topicId"
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
              disabled={!selectedGoalId}
            >
              <option value="">Select a topic</option>
              {availableTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="session-duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Duration (minutes)
            </label>
            <input
              id="session-duration"
              name="durationMinutes"
              type="number"
              min="1"
              max="480"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="session-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (optional)
            </label>
            <textarea
              id="session-notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Log Session
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

