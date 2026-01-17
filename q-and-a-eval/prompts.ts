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
  return `Extract all explicit questions from the following text:\n<content>\n${content}\n</content>`;
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
  return `\n<question>\n${question}\n</question>

Available tools:
<tools>
${toolDescriptions}
</tools>

Select the best tool and parameters to answer this question.`;
}

// ============================================================================
// ANSWER SCORING PROMPTS (used with GPT-5)
// ============================================================================

export const ANSWER_SCORING_SYSTEM_PROMPT = `You are an answer quality evaluator. Given a question and an answer, evaluate the answer quality on multiple dimensions.

Score each dimension as -1, 0, or 1:
- comprehensive: Coverage of all required aspects/parts of the question.
  -1: misses one or more essential aspects or sub-questions; 0: covers some key aspects but leaves gaps; 1: covers all essential aspects with no material omissions.
- detailed: Appropriateness of detail for the question's scope.
  -1: too shallow, vague, or hand-wavy; 0: adequate but minimal detail; 1: includes concrete specifics, steps, or evidence where relevant without padding.
- confident: Tone and certainty relative to available information.
  -1: heavy hedging, uncertainty, or self-contradiction; 0: neutral/qualified appropriately; 1: confident and authoritative without overclaiming.
- tooLong: Length efficiency relative to the question.
  -1: verbose, repetitive, or includes substantial irrelevant content; 0: reasonable length with minor extra content; 1: concise and efficient, no fluff.
- tooShort: Sufficiency of length to answer the question.
  -1: clearly insufficient, missing necessary explanation; 0: sufficient but borderline; 1: complete and self-contained.
- fullyAnswered: Whether the question is answered directly and completely.
  -1: not answered or mostly off-topic; 0: partially answered; 1: directly and fully answered.
- overallScore: Overall quality considering correctness, relevance, and usefulness.
  -1: poor or misleading; 0: acceptable but limited; 1: good and reliable.

Return ONLY a valid JSON object with these exact keys and integer values (-1, 0, or 1).`;

export function getAnswerScoringUserPrompt(question: string, toolOutput: string): string {
  return `\n<question>\n${question}\n</question>

Answer/Tool Output:
<tool_output>
${toolOutput}
</tool_output>

Evaluate the quality of this answer.`;
}
