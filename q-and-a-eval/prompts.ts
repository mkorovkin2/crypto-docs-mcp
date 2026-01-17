// ============================================================================
// PROMPTS CONFIGURATION
// Edit these prompts to customize the behavior of the idea processor
// ============================================================================

// ============================================================================
// QUESTION EXTRACTION PROMPTS (used with Grok)
// ============================================================================

export const QUESTION_EXTRACTION_SYSTEM_PROMPT = `You are a question extraction assistant. Your task is to read the provided text and extract ALL questions that are explicitly asked in it.

Return ONLY a valid JSON array of strings, where each string is a question from the text.
Do NOT include numbers, bullet points, or any formatting - just the question text itself.
If no questions are found, return an empty array: []

Example output format:
["What is the best approach?", "How do we handle errors?", "Why was this decision made?"]`;

export function getQuestionExtractionUserPrompt(content: string): string {
  return `Extract all explicit questions from the following text:\n\n${content}`;
}

// ============================================================================
// TOOL SELECTION PROMPTS (used with Grok)
// ============================================================================

export const TOOL_SELECTION_SYSTEM_PROMPT = `You are a tool selection assistant. Given a question and a list of available tools, select the most appropriate tool to answer the question and determine the parameters to pass.

Analyze the question carefully and determine if ANY of the available tools could reasonably be used to answer it. Consider the tool's description and input schema.

Return ONLY a valid JSON object with this structure:
{
  "toolName": "name_of_selected_tool",
  "params": { ... parameters to pass to the tool based on its input schema ... }
}

If and ONLY if there is truly NO tool that could possibly help answer the question, return:
{ "toolName": null, "params": {}, "reason": "brief explanation of why no tool matches" }`;

export function getToolSelectionUserPrompt(question: string, toolDescriptions: string): string {
  return `Question: ${question}

Available tools:
${toolDescriptions}

Select the best tool and parameters to answer this question.`;
}

// ============================================================================
// ANSWER SCORING PROMPTS (used with GPT-5)
// ============================================================================

export const ANSWER_SCORING_SYSTEM_PROMPT = `You are an answer quality evaluator. Given a question and an answer, evaluate the answer quality on multiple dimensions.

Score each dimension as -1, 0, or 1:
- comprehensive: Does the answer cover all aspects of the question? (-1: misses key aspects, 0: partially covers, 1: fully comprehensive)
- detailed: Is the answer appropriately detailed? (-1: lacks detail, 0: adequate detail, 1: well detailed)
- confident: Does the answer seem confident and authoritative? (-1: uncertain/hedging, 0: neutral, 1: confident)
- tooLong: Is the answer unnecessarily verbose? (-1: yes too long, 0: appropriate length, 1: concise and efficient)
- tooShort: Is the answer too brief? (-1: yes too short, 0: appropriate length, 1: complete)
- fullyAnswered: Was the question fully answered? (-1: not answered, 0: partially answered, 1: fully answered)
- overallScore: Overall quality assessment (-1: poor, 0: acceptable, 1: good)

Return ONLY a valid JSON object with these exact keys and integer values (-1, 0, or 1).`;

export function getAnswerScoringUserPrompt(question: string, toolOutput: string): string {
  return `Question: ${question}

Answer/Tool Output:
${toolOutput}

Evaluate the quality of this answer.`;
}
