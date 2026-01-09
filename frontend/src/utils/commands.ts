/**
 * Command Parser Utility
 * Parses chat messages starting with ! and extracts command and arguments
 */

export interface ParsedCommand {
  command: string;
  args: string[];
  raw: string;
  isValid: boolean;
}

/**
 * Parse a command string into structured command object
 */
export function parseCommand(message: string): ParsedCommand | null {
  const trimmed = message.trim();
  
  // Must start with !
  if (!trimmed.startsWith('!')) {
    return null;
  }

  // Extract command and arguments
  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1).filter(arg => arg.length > 0);

  // Validate command
  const validCommands = [
    'today', 'plan', 'goals', 'review', 'help', 'commands',
    'add', 'log', 'session', 'generate', 'refresh'
  ];

  const isValid = validCommands.includes(command) || command.startsWith('add') || command.startsWith('log');

  return {
    command,
    args,
    raw: trimmed,
    isValid,
  };
}

/**
 * Check if a message is a command
 */
export function isCommand(message: string): boolean {
  return message.trim().startsWith('!');
}

/**
 * Get command help text
 */
export function getCommandHelp(): string {
  return `🤖 **Available Commands:**

\`!today\` or \`!plan\` - Show or generate today's study plan
\`!goals\` - List all your active goals
\`!review\` - Show topics that need review
\`!add goal [title]\` - Create a new goal (interactive)
\`!log [topicName] [minutes]\` - Log a study session
\`!help\` or \`!commands\` - Show this help message

You can also chat normally with me about your studies!`;
}

/**
 * Extract arguments from command
 */
export function extractArgs(command: string, minArgs?: number, maxArgs?: number): {
  success: boolean;
  args?: string[];
  error?: string;
} {
  const parsed = parseCommand(command);
  
  if (!parsed) {
    return { success: false, error: 'Not a valid command' };
  }

  if (minArgs !== undefined && parsed.args.length < minArgs) {
    return { 
      success: false, 
      error: `Command requires at least ${minArgs} argument(s)` 
    };
  }

  if (maxArgs !== undefined && parsed.args.length > maxArgs) {
    return { 
      success: false, 
      error: `Command accepts at most ${maxArgs} argument(s)` 
    };
  }

  return { success: true, args: parsed.args };
}

