/**
 * Calendar Page - Week/Month view with planned tasks
 */

import Calendar from '../components/Calendar';

export default function CalendarPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <Calendar />
      </div>
    </div>
  );
}

