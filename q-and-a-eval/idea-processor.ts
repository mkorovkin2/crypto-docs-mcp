import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import {
  QUESTION_EXTRACTION_SYSTEM_PROMPT,
  getQuestionExtractionUserPrompt,
  TOOL_SELECTION_SYSTEM_PROMPT,
  getToolSelectionUserPrompt,
  ANSWER_SCORING_SYSTEM_PROMPT,
  getAnswerScoringUserPrompt,
} from "./prompts.js";

// ============================================================================
// LOAD ENVIRONMENT VARIABLES FROM .env FILE
// ============================================================================

// Load .env file - REQUIRED, no fallback to system environment variables
const envResult = dotenv.config();

if (envResult.error) {
  console.error(`[ERROR] Failed to load .env file: ${envResult.error.message}`);
  console.error("[ERROR] Please create a .env file with all required configuration.");
  console.error("[ERROR] See .env.example for the required format.");
  process.exit(1);
}

console.log("[INFO] Successfully loaded environment variables from .env file");

// ============================================================================
// VALIDATE REQUIRED ENVIRONMENT VARIABLES
// ============================================================================

const REQUIRED_ENV_VARS = [
  "XAI_API_KEY",
  "OPENAI_API_KEY",
  "MCP_ENDPOINT",
  "IDEAS_DIRECTORY",
  "DATABASE_PATH",
] as const;

const missingVars: string[] = [];

for (const varName of REQUIRED_ENV_VARS) {
  if (!process.env[varName]) {
    missingVars.push(varName);
  }
}

if (missingVars.length > 0) {
  console.error("[ERROR] Missing required environment variables in .env file:");
  for (const varName of missingVars) {
    console.error(`  - ${varName}`);
  }
  console.error("[ERROR] Please add all required variables to your .env file.");
  process.exit(1);
}

console.log("[INFO] All required environment variables are present");

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Directory to scan for IDEA_ files
  ideasDirectory: process.env.IDEAS_DIRECTORY!,

  // MCP Server Configuration
  mcpEndpoint: process.env.MCP_ENDPOINT!,

  // API Keys
  xaiApiKey: process.env.XAI_API_KEY!,
  openaiApiKey: process.env.OPENAI_API_KEY!,

  // xAI Grok API endpoint
  xaiApiEndpoint: "https://api.x.ai/v1/chat/completions",

  // OpenAI API endpoint
  openaiApiEndpoint: "https://api.openai.com/v1/chat/completions",

  // Database path
  databasePath: process.env.DATABASE_PATH!,

  // Models
  grokModel: "grok-4-1-fast-non-reasoning-latest",
  gpt5Model: "gpt-5",
};

// ============================================================================
// TYPES
// ============================================================================

interface ExtractedQuestion {
  text: string;
}

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface MCPToolCallResult {
  content?: Array<{ type: string; text?: string }>;
  error?: string;
}

interface ToolCallRecord {
  id: string;
  questionText: string;
  toolName: string;
  toolParams: string;
  toolInput: string;
  toolOutput: string;
  sourceFile: string;
  timestamp: string;
}

interface ScoreRecord {
  id: string;
  callId: string;
  comprehensive: number;
  detailed: number;
  confident: number;
  tooLong: number;
  tooShort: number;
  fullyAnswered: number;
  overallScore: number;
  timestamp: string;
}

type JsonRpcResponse<T> = {
  result?: T;
  error?: unknown;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

// ============================================================================
// LOGGING WITH COLORS
// ============================================================================

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",

  // Foreground colors
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Background colors
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};

enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  SUCCESS = "SUCCESS",
}

function getLogColor(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return colors.dim + colors.gray;
    case LogLevel.INFO:
      return colors.cyan;
    case LogLevel.WARN:
      return colors.yellow;
    case LogLevel.ERROR:
      return colors.bold + colors.red;
    case LogLevel.SUCCESS:
      return colors.bold + colors.green;
    default:
      return colors.reset;
  }
}

function log(level: LogLevel, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const color = getLogColor(level);
  const levelPadded = level.padEnd(7);
  const prefix = `${colors.dim}[${timestamp}]${colors.reset} ${color}[${levelPadded}]${colors.reset}`;

  if (data !== undefined) {
    const dataStr = JSON.stringify(data, null, 2);
    // Color the data dimmer for debug, normal for others
    const dataColor = level === LogLevel.DEBUG ? colors.dim : colors.reset;
    console.log(`${prefix} ${color}${message}${colors.reset}`);
    console.log(`${dataColor}${dataStr}${colors.reset}`);
  } else {
    console.log(`${prefix} ${color}${message}${colors.reset}`);
  }
}

function logInfo(message: string, data?: unknown): void {
  log(LogLevel.INFO, message, data);
}

function logDebug(message: string, data?: unknown): void {
  log(LogLevel.DEBUG, message, data);
}

function logWarn(message: string, data?: unknown): void {
  log(LogLevel.WARN, message, data);
}

function logError(message: string, data?: unknown): void {
  log(LogLevel.ERROR, message, data);
}

function logSuccess(message: string, data?: unknown): void {
  log(LogLevel.SUCCESS, message, data);
}

// ============================================================================
// DATABASE SETUP
// ============================================================================

function initializeDatabase(dbPath: string): Database.Database {
  logInfo(`Initializing SQLite database at: ${dbPath}`);

  const db = new Database(dbPath);

  // Create tool_calls table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_calls (
      id TEXT PRIMARY KEY,
      question_text TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      tool_params TEXT,
      tool_input TEXT,
      tool_output TEXT,
      source_file TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);

  // Create scores table
  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      call_id TEXT NOT NULL,
      comprehensive INTEGER NOT NULL,
      detailed INTEGER NOT NULL,
      confident INTEGER NOT NULL,
      too_long INTEGER NOT NULL,
      too_short INTEGER NOT NULL,
      fully_answered INTEGER NOT NULL,
      overall_score INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (call_id) REFERENCES tool_calls(id)
    )
  `);

  logInfo("Database tables initialized successfully");
  return db;
}

function insertToolCall(db: Database.Database, record: ToolCallRecord): void {
  const stmt = db.prepare(`
    INSERT INTO tool_calls (id, question_text, tool_name, tool_params, tool_input, tool_output, source_file, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    record.id,
    record.questionText,
    record.toolName,
    record.toolParams,
    record.toolInput,
    record.toolOutput,
    record.sourceFile,
    record.timestamp
  );

  logDebug(`Inserted tool call record with ID: ${record.id}`);
}

function insertScore(db: Database.Database, record: ScoreRecord): void {
  const stmt = db.prepare(`
    INSERT INTO scores (id, call_id, comprehensive, detailed, confident, too_long, too_short, fully_answered, overall_score, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    record.id,
    record.callId,
    record.comprehensive,
    record.detailed,
    record.confident,
    record.tooLong,
    record.tooShort,
    record.fullyAnswered,
    record.overallScore,
    record.timestamp
  );

  logDebug(`Inserted score record with ID: ${record.id} for call: ${record.callId}`);
}

// ============================================================================
// STARTUP CHECKS
// ============================================================================

async function checkApiKeys(): Promise<boolean> {
  logInfo("Checking API keys...");

  if (!CONFIG.xaiApiKey) {
    logError("XAI_API_KEY environment variable is not set");
    return false;
  }
  logSuccess("XAI API key is present");

  if (!CONFIG.openaiApiKey) {
    logError("OPENAI_API_KEY environment variable is not set");
    return false;
  }
  logSuccess("OpenAI API key is present");

  return true;
}

async function checkMcpEndpoint(): Promise<boolean> {
  logInfo(`Checking MCP endpoint accessibility at: ${CONFIG.mcpEndpoint}`);

  try {
    // Try to list tools to verify connectivity
    const response = await fetch(`${CONFIG.mcpEndpoint}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    if (!response.ok) {
      logError(`MCP endpoint returned status: ${response.status}`);
      return false;
    }

    const data = await readJson<JsonRpcResponse<unknown>>(response);
    if (data.error) {
      logError("MCP endpoint returned error:", data.error);
      return false;
    }

    logSuccess("MCP endpoint is accessible and responding");
    return true;
  } catch (error) {
    logError("Failed to connect to MCP endpoint:", error);
    return false;
  }
}

async function performStartupChecks(): Promise<boolean> {
  logInfo("=".repeat(60));
  logInfo("PERFORMING STARTUP CHECKS");
  logInfo("=".repeat(60));

  const apiKeysOk = await checkApiKeys();
  if (!apiKeysOk) {
    logError("API key check failed. Please set required environment variables.");
    return false;
  }

  const mcpOk = await checkMcpEndpoint();
  if (!mcpOk) {
    logError("MCP endpoint check failed. Please ensure the MCP server is running.");
    return false;
  }

  logInfo("=".repeat(60));
  logSuccess("ALL STARTUP CHECKS PASSED");
  logInfo("=".repeat(60));

  return true;
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

function discoverIdeaFiles(directory: string): string[] {
  logInfo(`Discovering IDEA_ files in directory: ${directory}`);

  if (!fs.existsSync(directory)) {
    logError(`Directory does not exist: ${directory}`);
    return [];
  }

  const files = fs.readdirSync(directory);
  const ideaFiles = files
    .filter((file) => file.startsWith("IDEA_"))
    .map((file) => path.join(directory, file));

  logInfo(`Found ${ideaFiles.length} IDEA_ files:`, ideaFiles);
  return ideaFiles;
}

function readFileContent(filePath: string): string {
  logInfo(`Reading file: ${filePath}`);

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    logDebug(`File content length: ${content.length} characters`);
    return content;
  } catch (error) {
    logError(`Failed to read file: ${filePath}`, error);
    throw error;
  }
}

// ============================================================================
// GROK 4 INTEGRATION - QUESTION EXTRACTION
// ============================================================================

async function extractQuestionsWithGrok(content: string): Promise<string[]> {
  logInfo("Extracting questions using xAI Grok 4 Fast model...");

  const systemPrompt = QUESTION_EXTRACTION_SYSTEM_PROMPT;
  const userPrompt = getQuestionExtractionUserPrompt(content);

  try {
    const response = await fetch(CONFIG.xaiApiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.xaiApiKey}`,
      },
      body: JSON.stringify({
        model: CONFIG.grokModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError(`Grok API error: ${response.status}`, errorText);
      throw new Error(`Grok API returned status ${response.status}`);
    }

    const data = await readJson<ChatCompletionResponse>(response);
    const responseContent = data.choices?.[0]?.message?.content || "[]";

    logDebug("Raw Grok response:", responseContent);

    // Parse the JSON response
    const questions: string[] = JSON.parse(responseContent);
    logInfo(`Extracted ${questions.length} questions from content`);
    logDebug("Extracted questions:", questions);

    return questions;
  } catch (error) {
    logError("Failed to extract questions with Grok:", error);
    throw error;
  }
}

// ============================================================================
// MCP TOOL OPERATIONS
// ============================================================================

async function listMcpTools(): Promise<MCPTool[]> {
  logInfo("Listing available MCP tools...");

  try {
    const response = await fetch(`${CONFIG.mcpEndpoint}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP tools/list returned status ${response.status}`);
    }

    const data = await readJson<JsonRpcResponse<{ tools?: MCPTool[] }>>(response);

    if (data.error) {
      throw new Error(`MCP error: ${JSON.stringify(data.error)}`);
    }

    const tools: MCPTool[] = data.result?.tools || [];
    logInfo(`Found ${tools.length} MCP tools available`);

    tools.forEach((tool) => {
      logDebug(`  - ${tool.name}: ${tool.description || "No description"}`);
    });

    return tools;
  } catch (error) {
    logError("Failed to list MCP tools:", error);
    throw error;
  }
}

interface ToolSelectionResult {
  tool: MCPTool | null;
  params: Record<string, unknown>;
  noToolReason?: string;
}

async function selectToolForQuestion(
  question: string,
  tools: MCPTool[]
): Promise<ToolSelectionResult> {
  logInfo(`Selecting appropriate tool for question: "${question.substring(0, 50)}..."`);

  if (tools.length === 0) {
    logWarn("No tools available to select from");
    return { tool: null, params: {}, noToolReason: "No MCP tools available on the server" };
  }

  // Use Grok to decide which tool to use
  const toolDescriptions = tools
    .map((t) => `- ${t.name}: ${t.description || "No description"}. Schema: ${JSON.stringify(t.inputSchema || {})}`)
    .join("\n");

  const systemPrompt = TOOL_SELECTION_SYSTEM_PROMPT;
  const userPrompt = getToolSelectionUserPrompt(question, toolDescriptions);

  try {
    const response = await fetch(CONFIG.xaiApiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.xaiApiKey}`,
      },
      body: JSON.stringify({
        model: CONFIG.grokModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API returned status ${response.status}`);
    }

    const data = await readJson<ChatCompletionResponse>(response);
    const responseContent = data.choices?.[0]?.message?.content || "{}";

    logDebug("Tool selection response:", responseContent);

    const selection = JSON.parse(responseContent);

    if (!selection.toolName) {
      const reason = selection.reason || "LLM determined no tool matches the question";
      logWarn(`No appropriate tool found for this question: ${reason}`);
      return { tool: null, params: {}, noToolReason: reason };
    }

    const selectedTool = tools.find((t) => t.name === selection.toolName);
    if (!selectedTool) {
      const reason = `LLM selected tool "${selection.toolName}" but it was not found in available tools`;
      logWarn(reason);
      return { tool: null, params: {}, noToolReason: reason };
    }

    logInfo(`Selected tool: ${selectedTool.name} with params:`, selection.params);
    return { tool: selectedTool, params: selection.params || {} };
  } catch (error) {
    logError("Failed to select tool for question:", error);
    return { tool: null, params: {}, noToolReason: `Error during tool selection: ${String(error)}` };
  }
}

async function callMcpTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<MCPToolCallResult> {
  logInfo(`Calling MCP tool: ${toolName} with params:`, params);

  try {
    const response = await fetch(`${CONFIG.mcpEndpoint}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: params,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP tools/call returned status ${response.status}`);
    }

    const data = await readJson<JsonRpcResponse<MCPToolCallResult>>(response);

    if (data.error) {
      logError(`MCP tool call error:`, data.error);
      return { error: JSON.stringify(data.error) };
    }

    const result: MCPToolCallResult = data.result || {};
    logInfo(`Tool call completed successfully`);
    logDebug("Tool result:", result);

    return result;
  } catch (error) {
    logError(`Failed to call MCP tool ${toolName}:`, error);
    return { error: String(error) };
  }
}

// ============================================================================
// OPENAI GPT-5 SCORING
// ============================================================================

interface ScoreResult {
  comprehensive: number;
  detailed: number;
  confident: number;
  tooLong: number;
  tooShort: number;
  fullyAnswered: number;
  overallScore: number;
}

async function scoreAnswerWithGpt5(
  question: string,
  toolOutput: string
): Promise<ScoreResult> {
  logInfo(`Scoring answer quality with GPT-5 for question: "${question.substring(0, 50)}..."`);

  const systemPrompt = ANSWER_SCORING_SYSTEM_PROMPT;
  const userPrompt = getAnswerScoringUserPrompt(question, toolOutput);

  try {
    const response = await fetch(CONFIG.openaiApiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: CONFIG.gpt5Model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        // Note: GPT-5 only supports temperature=1 (default), so we omit it
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError(`GPT-5 API error: ${response.status}`, errorText);
      throw new Error(`GPT-5 API returned status ${response.status}`);
    }

    const data = await readJson<ChatCompletionResponse>(response);
    const responseContent = data.choices?.[0]?.message?.content || "{}";

    logDebug("GPT-5 scoring response:", responseContent);

    const scores: ScoreResult = JSON.parse(responseContent);

    // Validate scores are -1, 0, or 1
    const validateScore = (score: number): number => {
      if (score === -1 || score === 0 || score === 1) return score;
      return 0; // Default to neutral if invalid
    };

    const validatedScores: ScoreResult = {
      comprehensive: validateScore(scores.comprehensive),
      detailed: validateScore(scores.detailed),
      confident: validateScore(scores.confident),
      tooLong: validateScore(scores.tooLong),
      tooShort: validateScore(scores.tooShort),
      fullyAnswered: validateScore(scores.fullyAnswered),
      overallScore: validateScore(scores.overallScore),
    };

    logInfo("Answer scores:", validatedScores);
    return validatedScores;
  } catch (error) {
    logError("Failed to score answer with GPT-5:", error);
    // Return neutral scores on error
    return {
      comprehensive: 0,
      detailed: 0,
      confident: 0,
      tooLong: 0,
      tooShort: 0,
      fullyAnswered: 0,
      overallScore: 0,
    };
  }
}

// ============================================================================
// MAIN PROCESSING FLOW
// ============================================================================

async function processQuestion(
  db: Database.Database,
  question: string,
  tools: MCPTool[],
  sourceFile: string
): Promise<void> {
  logInfo("=".repeat(40));
  logInfo(`Processing question: "${question}"`);
  logInfo("=".repeat(40));

  // Step 1: Select appropriate tool
  const toolSelection = await selectToolForQuestion(question, tools);

  const callId = uuidv4();

  // Handle case where no tool was selected
  if (!toolSelection.tool) {
    logWarn(`No tool selected for this question: ${toolSelection.noToolReason}`);

    // Still record this in the database with NO_TOOL_MATCH indicator
    const callRecord: ToolCallRecord = {
      id: callId,
      questionText: question,
      toolName: "NO_TOOL_MATCH",
      toolParams: "{}",
      toolInput: "{}",
      toolOutput: toolSelection.noToolReason || "No matching tool found",
      sourceFile: sourceFile,
      timestamp: new Date().toISOString(),
    };

    insertToolCall(db, callRecord);
    logWarn(`No-tool-match recorded with ID: ${callId}`);

    // Record scores as all -2 to indicate no tool was available (not applicable)
    const scoreId = uuidv4();
    const scoreRecord: ScoreRecord = {
      id: scoreId,
      callId: callId,
      comprehensive: -2,
      detailed: -2,
      confident: -2,
      tooLong: -2,
      tooShort: -2,
      fullyAnswered: -2,
      overallScore: -2,
      timestamp: new Date().toISOString(),
    };

    insertScore(db, scoreRecord);
    logWarn(`No-tool-match scores recorded with ID: ${scoreId}`);
    return;
  }

  // Step 2: Call the selected tool
  const toolResult = await callMcpTool(toolSelection.tool.name, toolSelection.params);

  // Extract text output from result
  let outputText = "";
  if (toolResult.error) {
    outputText = `Error: ${toolResult.error}`;
  } else if (toolResult.content) {
    outputText = toolResult.content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("\n");
  }

  // Step 3: Store tool call in database
  const callRecord: ToolCallRecord = {
    id: callId,
    questionText: question,
    toolName: toolSelection.tool.name,
    toolParams: JSON.stringify(toolSelection.tool.inputSchema || {}),
    toolInput: JSON.stringify(toolSelection.params),
    toolOutput: outputText,
    sourceFile: sourceFile,
    timestamp: new Date().toISOString(),
  };

  insertToolCall(db, callRecord);
  logSuccess(`Tool call recorded with ID: ${callId}`);

  // Step 4: Score the answer with GPT-5
  const scores = await scoreAnswerWithGpt5(question, outputText);

  // Step 5: Store scores in database
  const scoreId = uuidv4();
  const scoreRecord: ScoreRecord = {
    id: scoreId,
    callId: callId,
    comprehensive: scores.comprehensive,
    detailed: scores.detailed,
    confident: scores.confident,
    tooLong: scores.tooLong,
    tooShort: scores.tooShort,
    fullyAnswered: scores.fullyAnswered,
    overallScore: scores.overallScore,
    timestamp: new Date().toISOString(),
  };

  insertScore(db, scoreRecord);
  logSuccess(`Scores recorded with ID: ${scoreId}`);
}

async function processFile(
  db: Database.Database,
  filePath: string,
  tools: MCPTool[]
): Promise<void> {
  logInfo("*".repeat(60));
  logInfo(`PROCESSING FILE: ${filePath}`);
  logInfo("*".repeat(60));

  // Step 1: Read file content
  const content = readFileContent(filePath);

  // Step 2: Extract questions using Grok
  const questions = await extractQuestionsWithGrok(content);

  if (questions.length === 0) {
    logWarn(`No questions found in file: ${filePath}`);
    return;
  }

  // Step 3: Process each question - continue even if individual questions fail
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < questions.length; i++) {
    logInfo(`Processing question ${i + 1} of ${questions.length}`);
    try {
      await processQuestion(db, questions[i], tools, filePath);
      successCount++;
    } catch (error) {
      failCount++;
      logError(`Failed to process question ${i + 1}: "${questions[i]}"`, error);
      logWarn("Continuing to next question...");
    }
  }

  logSuccess(`Completed processing file: ${filePath} (${successCount} succeeded, ${failCount} failed)`);
}

async function main(): Promise<void> {
  logInfo("#".repeat(60));
  logInfo("IDEA PROCESSOR - STARTING");
  logInfo("#".repeat(60));

  // Step 1: Perform startup checks
  const checksOk = await performStartupChecks();
  if (!checksOk) {
    logError("Startup checks failed. Exiting.");
    process.exit(1);
  }

  // Step 2: Initialize database
  const db = initializeDatabase(CONFIG.databasePath);

  try {
    // Step 3: Discover IDEA_ files
    const ideaFiles = discoverIdeaFiles(CONFIG.ideasDirectory);

    if (ideaFiles.length === 0) {
      logWarn("No IDEA_ files found. Nothing to process.");
      return;
    }

    // Step 4: List available MCP tools
    const tools = await listMcpTools();

    if (tools.length === 0) {
      logWarn("No MCP tools available. Cannot process questions.");
      return;
    }

    // Step 5: Process each file - continue even if individual files fail
    let fileSuccessCount = 0;
    let fileFailCount = 0;

    for (let i = 0; i < ideaFiles.length; i++) {
      const filePath = ideaFiles[i];
      logInfo(`Processing file ${i + 1} of ${ideaFiles.length}: ${filePath}`);
      try {
        await processFile(db, filePath, tools);
        fileSuccessCount++;
      } catch (error) {
        fileFailCount++;
        logError(`Failed to process file: ${filePath}`, error);
        logWarn("Continuing to next file...");
      }
    }

    logSuccess("#".repeat(60));
    logSuccess(`IDEA PROCESSOR - COMPLETED (${fileSuccessCount} files succeeded, ${fileFailCount} files failed)`);
    logSuccess("#".repeat(60));
  } catch (error) {
    logError("Fatal error during processing:", error);
    process.exit(1);
  } finally {
    db.close();
    logInfo("Database connection closed");
  }
}

// Run the main function
main().catch((error) => {
  logError("Unhandled error:", error);
  process.exit(1);
});
