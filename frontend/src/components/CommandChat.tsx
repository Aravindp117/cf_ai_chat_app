/**
 * Command Chat Component with command parsing
 */

import { useState, useRef, useEffect } from 'react';
import { chatApi, plansApi, sessionsApi } from '../api/client';
import { useApp } from '../context/AppContext';
import { parseCommand, isCommand, getCommandHelp } from '../utils/commands';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export default function CommandChat() {
  const { refreshAll, goals, todayPlan, reviewTopics } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCommand = async (command: string): Promise<string | null> => {
    const parsed = parseCommand(command);
    if (!parsed) return null;

    const cmd = parsed.command;
    const args = parsed.args;

    // !today or !plan
    if (cmd === 'today' || cmd === 'plan') {
      if (todayPlan) {
        const tasksSummary = todayPlan.tasks
          .map(
            (t, i) =>
              `${i + 1}. ${t.type === 'review' ? '🔄 Review' : t.type === 'study' ? '📚 Study' : '💼 Project'}: ${t.estimatedMinutes} min (Priority: ${'★'.repeat(t.priority)}`
          )
          .join('\n');
        return `📅 **Today's Study Plan**\n\n${todayPlan.reasoning}\n\n**Tasks:**\n${tasksSummary}`;
      } else {
        try {
          const plan = await plansApi.generate();
          refreshAll();
          const tasksSummary = plan.tasks
            .map(
              (t, i) =>
                `${i + 1}. ${t.type === 'review' ? '🔄 Review' : t.type === 'study' ? '📚 Study' : '💼 Project'}: ${t.estimatedMinutes} min`
            )
            .join('\n');
          return `📅 **Generated Today's Plan**\n\n${plan.reasoning}\n\n**Tasks:**\n${tasksSummary}`;
        } catch (error) {
          return '❌ Error generating plan. Please try again.';
        }
      }
    }

    // !goals
    if (cmd === 'goals') {
      const activeGoals = goals.filter((g) => g.status === 'active');
      if (activeGoals.length === 0) {
        return '📚 You don\'t have any active goals yet. Create one to get started!';
      }
      const goalsList = activeGoals
        .map((g, i) => {
          const daysUntil = Math.ceil(
            (new Date(g.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );
          return `${i + 1}. **${g.title}** (${g.type})\n   Priority: ${'★'.repeat(g.priority)}${'☆'.repeat(5 - g.priority)}\n   Deadline: ${new Date(g.deadline).toLocaleDateString()} (${daysUntil} days left)`;
        })
        .join('\n\n');
      return `📚 **Your Active Goals** (${activeGoals.length}):\n\n${goalsList}`;
    }

    // !review
    if (cmd === 'review') {
      if (reviewTopics.length === 0) {
        return '✅ Great! No topics need review right now. Keep up the good work!';
      }
      const topicsList = reviewTopics
        .slice(0, 10)
        .map((t, i) => `${i + 1}. **${t.name}**\n   Mastery: ${t.masteryLevel}% | Reviews: ${t.reviewCount}`)
        .join('\n\n');
      return `🔄 **Topics Needing Review** (${reviewTopics.length}):\n\n${topicsList}`;
    }

    // !help
    if (cmd === 'help' || cmd === 'commands') {
      return getCommandHelp();
    }

    // !add goal [title]
    if (cmd === 'add' && args[0] === 'goal' && args.length >= 2) {
      const title = args.slice(1).join(' ');
      try {
        // This would need a modal or follow-up prompts in a real implementation
        return `📝 To create a goal "${title}", please use the Goals page or provide more details:\n- Type: exam/project/commitment\n- Deadline: YYYY-MM-DD\n- Priority: 1-5\n\nOr use the web interface for easier goal creation.`;
      } catch (error) {
        return '❌ Error creating goal. Please try again.';
      }
    }

    // !log [topicName] [minutes]
    if (cmd === 'log' && args.length >= 2) {
      const topicName = args[0];
      const minutes = parseInt(args[1]);
      
      if (isNaN(minutes) || minutes <= 0) {
        return '❌ Invalid duration. Usage: !log [topicName] [minutes]';
      }

      // Find topic in goals
      const allTopics = goals.flatMap(g => g.topics.map(t => ({ topic: t, goal: g })));
      const topicMatch = allTopics.find(({ topic }) => 
        topic.name.toLowerCase().includes(topicName.toLowerCase())
      );

      if (!topicMatch) {
        return `❌ Topic "${topicName}" not found. Available topics:\n${allTopics.map(({ topic }) => `- ${topic.name}`).join('\n')}`;
      }

      try {
        await sessionsApi.create({
          topicId: topicMatch.topic.id,
          goalId: topicMatch.goal.id,
          durationMinutes: minutes,
          notes: `Logged via chat command`,
        });
        refreshAll();
        return `✅ Logged ${minutes} minutes of study for "${topicMatch.topic.name}"`;
      } catch (error) {
        return '❌ Error logging session. Please try again.';
      }
    }

    // !generate or !refresh
    if (cmd === 'generate' || cmd === 'refresh') {
      try {
        const plan = await plansApi.generate();
        refreshAll();
        const tasksSummary = plan.tasks
          .map((t, i) => `${i + 1}. ${t.type === 'review' ? '🔄 Review' : t.type === 'study' ? '📚 Study' : '💼 Project'}: ${t.estimatedMinutes} min`)
          .join('\n');
        return `📅 **Generated New Plan**\n\n${plan.reasoning}\n\n**Tasks:**\n${tasksSummary}`;
      } catch (error) {
        return '❌ Error generating plan. Please try again.';
      }
    }

    return null;
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Check for commands first
      if (isCommand(userMessage.text)) {
        const commandResponse = await handleCommand(userMessage.text);
        
        if (commandResponse) {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: commandResponse,
            sender: 'ai',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
        } else {
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: '❌ Unknown command. Type !help for available commands.',
            sender: 'ai',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      } else {
        // Not a command, send to AI
        const response = await chatApi.sendMessage(userMessage.text);
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: response.reply,
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `❌ Error: ${error instanceof Error ? error.message : 'Sorry, there was an error. Please try again.'}`,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg">
      <div className="bg-blue-600 dark:bg-blue-700 text-white p-4 shadow-md">
        <h1 className="text-xl font-semibold">Study Planner Chat</h1>
        <p className="text-sm text-blue-100">Type !help for commands</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <p className="text-lg">Welcome! Start a conversation.</p>
            <p className="text-sm mt-2">Try commands like !today, !goals, or !review</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-4 py-2 ${
                message.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
              <p
                className={`text-xs mt-1 ${
                  message.sender === 'user'
                    ? 'text-blue-100'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-lg rounded-bl-none px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-300 dark:border-gray-600 p-4 bg-white dark:bg-gray-800">
        <div className="flex space-x-2">
          <label htmlFor="chat-input" className="sr-only">
            Chat message input
          </label>
          <input
            id="chat-input"
            name="message"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message or command (!help for commands)..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={isLoading || !inputText.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

