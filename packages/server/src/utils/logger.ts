/**
 * Logger Utility for MCP Server
 *
 * Provides colored, structured logging for debugging and monitoring.
 * Enable verbose logging with LOG_LEVEL=debug environment variable.
 */

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get log level from environment
const currentLevel = (process.env.LOG_LEVEL?.toLowerCase() || 'info') as LogLevel;
const currentLevelNum = LOG_LEVELS[currentLevel] ?? LOG_LEVELS.info;

// Check if verbose/debug mode is enabled
const isVerbose = process.env.LOG_LEVEL === 'debug' || process.env.VERBOSE === 'true';

/**
 * Format a timestamp for logging
 */
function timestamp(): string {
  const now = new Date();
  return `${colors.dim}[${now.toISOString().slice(11, 23)}]${colors.reset}`;
}

/**
 * Format a log prefix with color
 */
function prefix(level: LogLevel, component?: string): string {
  const levelColors: Record<LogLevel, string> = {
    debug: colors.cyan,
    info: colors.green,
    warn: colors.yellow,
    error: colors.red,
  };

  const levelStr = `${levelColors[level]}${level.toUpperCase().padEnd(5)}${colors.reset}`;
  const componentStr = component
    ? `${colors.magenta}[${component}]${colors.reset}`
    : '';

  return `${timestamp()} ${levelStr} ${componentStr}`;
}

/**
 * Format data for logging (handles objects, arrays, etc.)
 */
function formatData(data: unknown): string {
  if (data === undefined || data === null) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'number' || typeof data === 'boolean') return String(data);

  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

/**
 * Main logger class
 */
class Logger {
  private component?: string;

  constructor(component?: string) {
    this.component = component;
  }

  /**
   * Create a child logger with a component name
   */
  child(component: string): Logger {
    return new Logger(component);
  }

  /**
   * Debug level logging (only shown when LOG_LEVEL=debug)
   */
  debug(message: string, data?: unknown): void {
    if (currentLevelNum > LOG_LEVELS.debug) return;
    console.log(`${prefix('debug', this.component)} ${message}`);
    if (data !== undefined) {
      console.log(`${colors.dim}${formatData(data)}${colors.reset}`);
    }
  }

  /**
   * Info level logging
   */
  info(message: string, data?: unknown): void {
    if (currentLevelNum > LOG_LEVELS.info) return;
    console.log(`${prefix('info', this.component)} ${message}`);
    if (data !== undefined && isVerbose) {
      console.log(`${colors.dim}${formatData(data)}${colors.reset}`);
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: unknown): void {
    if (currentLevelNum > LOG_LEVELS.warn) return;
    console.warn(`${prefix('warn', this.component)} ${message}`);
    if (data !== undefined) {
      console.warn(`${colors.dim}${formatData(data)}${colors.reset}`);
    }
  }

  /**
   * Error level logging
   */
  error(message: string, error?: unknown): void {
    console.error(`${prefix('error', this.component)} ${message}`);
    if (error instanceof Error) {
      console.error(`${colors.red}${error.message}${colors.reset}`);
      if (isVerbose && error.stack) {
        console.error(`${colors.dim}${error.stack}${colors.reset}`);
      }
    } else if (error !== undefined) {
      console.error(`${colors.dim}${formatData(error)}${colors.reset}`);
    }
  }

  /**
   * Log a separator line for visual clarity
   */
  separator(char: string = '─'): void {
    if (currentLevelNum > LOG_LEVELS.debug) return;
    console.log(`${colors.dim}${char.repeat(60)}${colors.reset}`);
  }

  /**
   * Log a tool call start
   */
  toolStart(toolName: string, args: Record<string, unknown>): void {
    console.log(`\n${colors.bright}${colors.blue}▶ TOOL CALL: ${toolName}${colors.reset}`);
    console.log(`${colors.dim}  Args: ${JSON.stringify(args)}${colors.reset}`);
    this.separator();
  }

  /**
   * Log a tool call end with timing
   */
  toolEnd(toolName: string, durationMs: number, success: boolean): void {
    this.separator();
    const status = success
      ? `${colors.green}✓ SUCCESS${colors.reset}`
      : `${colors.red}✗ FAILED${colors.reset}`;
    console.log(`${colors.bright}${colors.blue}◀ ${toolName}${colors.reset} ${status} ${colors.dim}(${durationMs}ms)${colors.reset}\n`);
  }

  /**
   * Log search operation
   */
  search(query: string, resultCount: number, durationMs: number): void {
    console.log(`${prefix('info', 'Search')} Query: "${colors.cyan}${query.slice(0, 60)}${query.length > 60 ? '...' : ''}${colors.reset}"`);
    console.log(`${prefix('info', 'Search')} Found ${colors.yellow}${resultCount}${colors.reset} results in ${durationMs}ms`);
  }

  /**
   * Log query analysis
   */
  queryAnalysis(analysis: {
    type: string;
    expandedQuery: string;
    keywords: string[];
    suggestedLimit: number;
  }): void {
    console.log(`${prefix('debug', 'QueryAnalyzer')} Type: ${colors.yellow}${analysis.type}${colors.reset}`);
    console.log(`${prefix('debug', 'QueryAnalyzer')} Keywords: ${colors.cyan}${analysis.keywords.join(', ') || '(none)'}${colors.reset}`);
    console.log(`${prefix('debug', 'QueryAnalyzer')} Expanded: "${analysis.expandedQuery.slice(0, 80)}${analysis.expandedQuery.length > 80 ? '...' : ''}"`);
  }

  /**
   * Log confidence score
   */
  confidence(score: number, factors?: Record<string, number>): void {
    const color = score >= 70 ? colors.green : score >= 40 ? colors.yellow : colors.red;
    console.log(`${prefix('info', 'Confidence')} Score: ${color}${score}${colors.reset}/100`);
    if (factors && isVerbose) {
      console.log(`${prefix('debug', 'Confidence')} Factors: ${JSON.stringify(factors)}`);
    }
  }

  /**
   * Log corrective RAG activity
   */
  correctiveRAG(wasRetried: boolean, retriesUsed: number, alternativeQueries: string[]): void {
    if (wasRetried) {
      console.log(`${prefix('info', 'CorrectiveRAG')} ${colors.yellow}Retried ${retriesUsed} time(s)${colors.reset}`);
      for (const q of alternativeQueries) {
        console.log(`${prefix('debug', 'CorrectiveRAG')} Alt query: "${q.slice(0, 60)}${q.length > 60 ? '...' : ''}"`);
      }
    }
  }

  /**
   * Log LLM synthesis
   */
  llmSynthesis(promptTokens: number, responseLength: number, durationMs: number): void {
    console.log(`${prefix('info', 'LLM')} Synthesizing response...`);
    console.log(`${prefix('debug', 'LLM')} Response: ${responseLength} chars in ${durationMs}ms`);
  }

  /**
   * Log reranking
   */
  rerank(inputCount: number, outputCount: number, durationMs: number): void {
    console.log(`${prefix('debug', 'Reranker')} Reranked ${inputCount} → ${outputCount} results in ${durationMs}ms`);
  }
}

// Export singleton logger
export const logger = new Logger();

// Export child loggers for different components
export const toolLogger = logger.child('Tools');
export const searchLogger = logger.child('Search');
export const llmLogger = logger.child('LLM');
export const ragLogger = logger.child('RAG');
