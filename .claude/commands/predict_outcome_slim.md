---
description: Slim version of predict_outcome - same deep research but limits parallel agents to 3 at a time for lower resource usage.
argument-hint: "<binary yes/no question about a real-world event>"
allowed-tools: Read, Write, Grep, Glob, Task, TodoWrite, WebSearch, WebFetch
model: opus
---

# Predict Outcome (Slim)

Same thorough research as `/predict_outcome` but runs agents in waves of 3 to reduce resource usage. Uses all 10 specialized agents but executes them sequentially in batches.

## Probability Buckets

| Bucket | Implied Range | Meaning |
|--------|---------------|---------|
| **near zero** | 0-5% | Extremely unlikely, no credible path to YES |
| **very low** | 5-15% | Unlikely, major obstacles, would require significant surprises |
| **low** | 15-30% | Below average likelihood, meaningful obstacles exist |
| **medium** | 30-50% | Genuinely uncertain, evidence roughly balanced |
| **high** | 50-70% | More likely than not, clear path exists |
| **very high** | 70-85% | Likely, would require obstacles to fail |
| **near 100** | 85-100% | Extremely likely, hard to see how it fails |

## How to Use

```
/predict_outcome_slim "Will the Fed cut interest rates in Q1 2025?"
/predict_outcome_slim "Will Ukraine recapture Crimea by end of 2025?"
```

## Your Process

### Step 1: Parse the Question

Extract and clarify:
1. **The Outcome**: What specific event/state are we predicting?
2. **YES means**: Exact definition of what counts as YES
3. **NO means**: Exact definition of what counts as NO
4. **Timeframe**: By when? (If not specified, ask)
5. **Key Entities**: People, organizations, places involved

If the question is ambiguous, ask for clarification.

### Step 2: Create Research Plan

Use TodoWrite to track progress through all 4 waves:

```
1. Parse and clarify question - [in_progress]
2. Wave 1: News + Data + Expert agents - [pending]
3. Wave 2: Historical + Official Docs + Contrarian agents - [pending]
4. Wave 3: Social Media + Financial + Web Search agents - [pending]
5. Wave 4: Technical researcher - [pending]
6. Synthesize all findings - [pending]
7. Assign probability bucket - [pending]
8. Generate research document - [pending]
```

### Step 3: Execute Research in Waves

**CRITICAL**: Only spawn 3 agents at a time. Wait for each wave to complete before starting the next.

---

#### WAVE 1: Current State & Data (3 agents)

Spawn these 3 agents IN PARALLEL in a single message:

**Agent 1: news-researcher**
```
Task with subagent_type="news-researcher":

Research current news and recent developments about: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]
Timeframe: [timeframe]

## Your Focus
- What is the current situation?
- What has happened recently (last 30-90 days)?
- What upcoming events are scheduled?

## Requirements
- Read at least 15-20 articles from authoritative sources
- Cite every source with full URL
```

**Agent 2: data-researcher**
```
Task with subagent_type="data-researcher":

Research quantitative data and statistics about: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]

## Your Focus
- Polling data (if political)
- Prediction market odds (Polymarket, Metaculus)
- Economic/statistical data
- Measurable indicators

## Requirements
- Note sample sizes and margins of error
- Get current prediction market prices
```

**Agent 3: expert-opinion-researcher**
```
Task with subagent_type="expert-opinion-researcher":

Research expert opinions and predictions about: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]

## Your Focus
- What do credentialed experts predict?
- What do think tanks say?
- Where do experts disagree?

## Requirements
- Find named experts with credentials
- Include think tank reports
- Document both consensus and dissent
```

**WAIT for all 3 agents to complete before proceeding to Wave 2.**

---

#### WAVE 2: Historical, Official & Contrarian (3 agents)

Spawn these 3 agents IN PARALLEL:

**Agent 4: historical-precedent-researcher**
```
Task with subagent_type="historical-precedent-researcher":

Research historical precedents for: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]

## Your Focus
- Find similar historical situations
- How did they resolve?
- Calculate base rates if possible

## Requirements
- Find at least 3-5 relevant precedents
- Include academic/archival sources
```

**Agent 5: official-docs-researcher**
```
Task with subagent_type="official-docs-researcher":

Research official documents and government sources about: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]

## Your Focus
- Government reports and publications
- Legal filings and court documents
- Regulatory announcements
- Official statistics

## Requirements
- DOWNLOAD AND READ actual PDFs
- Go to primary sources, not news summaries
```

**Agent 6: contrarian-researcher**
```
Task with subagent_type="contrarian-researcher":

Research reasons why [OUTCOME] will NOT happen: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
The expected/consensus outcome appears to be: [LEANING based on Wave 1]

## Your ONLY Job
Find reasons this prediction will be WRONG. You are the devil's advocate.

## Your Focus
- What obstacles exist?
- Who opposes this and why?
- What similar predictions failed?
- What assumptions could be wrong?

## Requirements
- Be genuinely adversarial
- Find real skeptics and critics
- Present the strongest case AGAINST
```

**WAIT for all 3 agents to complete before proceeding to Wave 3.**

---

#### WAVE 3: Sentiment & Markets (3 agents)

Spawn these 3 agents IN PARALLEL:

**Agent 7: social-media-researcher**
```
Task with subagent_type="social-media-researcher":

Research social media sentiment about: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]

## Your Focus
- What is public sentiment?
- Who are influential voices?
- Are there grassroots movements?
- What narratives are spreading?

## Requirements
- Search Twitter/X, Reddit, YouTube
- Assess sentiment (pro/anti/mixed)
```

**Agent 8: financial-markets-researcher**
```
Task with subagent_type="financial-markets-researcher":

Research financial market signals about: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]

## Your Focus
- What are affected stocks/sectors doing?
- What do options markets imply?
- What are analysts saying?

## Requirements
- Find relevant tickers and prices
- Include prediction market odds if available
```

**Agent 9: web-search-researcher**
```
Task with subagent_type="web-search-researcher":

Conduct broad web research about: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]

## Your Focus
- General background and context
- Recent analysis and commentary
- Perspectives not covered by other agents
- International viewpoints

## Requirements
- Search broadly across the web
- Find quality analysis pieces
```

**WAIT for all 3 agents to complete before proceeding to Wave 4.**

---

#### WAVE 4: Technical Deep Dive (1 agent)

Spawn final agent:

**Agent 10: technical-researcher**
```
Task with subagent_type="technical-researcher":

Research technical/domain-specific aspects of: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]

## Your Focus
- Domain-specific technical details
- Specialized documentation
- Technical constraints or enablers

## Requirements
- Focus on technical/domain expertise
- Find authoritative technical sources
```

**WAIT for agent to complete.**

---

### Step 4: Synthesize Findings

Once ALL 4 WAVES are complete, synthesize:

#### 4a: Compile Evidence For YES
From all 10 agents, list evidence supporting the outcome.

#### 4b: Compile Evidence For NO
From contrarian researcher especially, plus other agents' caveats.

#### 4c: Assess Base Rates
From historical-precedent-researcher.

#### 4d: Check Market/Expert Consensus
From data-researcher and expert-opinion-researcher.

#### 4e: Weight the Evidence

| Source Type | Weight |
|-------------|--------|
| Official government documents/data | Highest |
| Court rulings/legal filings | Highest |
| Academic/peer-reviewed research | High |
| Reputable news (Reuters, AP, BBC) | High |
| Expert opinion (credentialed) | Medium-High |
| Prediction markets | Medium |
| Think tank analysis | Medium |
| Social media sentiment | Low-Medium |

### Step 5: Assign Probability Bucket

Using the synthesized evidence, assign ONE bucket:

- **near zero**: No credible path, overwhelming evidence against
- **very low**: Major structural obstacles, would require surprises
- **low**: Meaningful obstacles, evidence leans NO
- **medium**: Evidence genuinely balanced, significant uncertainty
- **high**: Evidence leans YES, clear path exists
- **very high**: Strong evidence for YES, obstacles would need to emerge
- **near 100**: Outcome nearly inevitable

**Tie-Breaking Rules:**
1. Defer to base rates when uncertain
2. Defer to prediction markets when base rates unavailable
3. Always give extra weight to contrarian findings

### Step 6: Generate Research Document

Save to: `thoughts/shared/research/YYYY-MM-DD-prediction-[topic-slug].md`

**CRITICAL: WRITE IN PARTS TO AVOID TOKEN LIMITS**

The research document will be large. To avoid output token limits and write failures:

1. **Write the document in sequential parts** using multiple Write/Edit tool calls
2. **Part 1**: Write frontmatter + Executive Summary
3. **Part 2**: Write Wave 1 + Wave 2 Findings
4. **Part 3**: Write Wave 3 + Wave 4 Findings
5. **Part 4**: Write Evidence Synthesis + Probability Assessment
6. **Part 5**: Write Full Citation List

**Example approach:**
```
# First write call - create file with Part 1
Write(file_path, content="---\nfrontmatter...\n## Executive Summary\n...\n\n<!-- CONTINUE -->")

# Subsequent calls - replace marker and add next section
Edit(file_path, old_string="<!-- CONTINUE -->", new_string="## Wave 1 Findings\n...\n\n<!-- CONTINUE -->")
```

**DO NOT** attempt to write the entire document in a single tool call - it will fail or truncate.

Use same template as `/predict_outcome`:

```markdown
---
type: prediction-research
question: "[Original question]"
probability_bucket: "[bucket]"
research_date: "YYYY-MM-DD"
total_sources: [count]
agents_used: 10
execution_mode: slim (3 parallel max)
---

# Prediction Research: [Question]

## Executive Summary

**Question**: [Full question]
**Probability Bucket**: **[BUCKET]**
**One-Line Summary**: [One sentence]

### Key Evidence For YES
1. [Evidence] — *[Source]*
2. [Evidence] — *[Source]*
3. [Evidence] — *[Source]*

### Key Evidence For NO
1. [Evidence] — *[Source]*
2. [Evidence] — *[Source]*
3. [Evidence] — *[Source]*

---

## Detailed Findings by Research Area

### Wave 1 Findings
#### Current Situation (news-researcher)
[Summary with citations]

#### Quantitative Data (data-researcher)
[Summary with citations]

#### Expert Analysis (expert-opinion-researcher)
[Summary with citations]

### Wave 2 Findings
#### Historical Precedents (historical-precedent-researcher)
[Summary with citations]

#### Official Documents (official-docs-researcher)
[Summary with citations]

#### Contrarian Analysis (contrarian-researcher)
[Summary with citations]

### Wave 3 Findings
#### Social Media Sentiment (social-media-researcher)
[Summary with citations]

#### Financial Markets (financial-markets-researcher)
[Summary with citations]

#### Additional Context (web-search-researcher)
[Summary with citations]

### Wave 4 Findings
#### Technical Details (technical-researcher)
[Summary with citations]

---

## Evidence Synthesis
[Tables of factors for/against]

## Probability Assessment
**Bucket**: [BUCKET]
**Reasoning**: [Why this bucket]

---

## Full Citation List
[All sources from all agents]
```

### Step 7: Present Summary

```markdown
## Prediction Analysis Complete

**Question**: [Question]
**Probability Bucket**: **[BUCKET]**

### Summary
[2-3 sentences]

### Top Evidence For YES
1. [Point]
2. [Point]
3. [Point]

### Top Evidence For NO
1. [Point]
2. [Point]
3. [Point]

### Key Data Points
- **Prediction Markets**: [Odds]
- **Expert Consensus**: [Summary]
- **Historical Base Rate**: [%]

---
**Execution**: 4 waves, 3 agents max per wave
**Full document**: `thoughts/shared/research/YYYY-MM-DD-prediction-[topic].md`
```

## Wave Summary

| Wave | Agents | Focus |
|------|--------|-------|
| 1 | news, data, expert | Current state & consensus |
| 2 | historical, official-docs, contrarian | Deep analysis & counter-arguments |
| 3 | social-media, financial, web-search | Sentiment & markets |
| 4 | technical | Domain expertise |

## Key Differences from Other Variants

| Aspect | /predict_outcome | /predict_outcome_slim | /predict_outcome_fast |
|--------|------------------|----------------------|----------------------|
| Parallel agents | 10 at once | 3 at once (4 waves) | 3 at once (3 waves) |
| Total agents | 10 | 10 | 8 lite agents |
| Token budget/agent | ~40-100k | ~20-35k (with guidance) | ~10-15k |
| Total tokens | ~500-800k | ~200-350k | ~100-150k |
| Speed | Fastest | Slower | Medium |
| Thoroughness | Highest | High | Good |

**For lower token usage**: Use `/predict_outcome_fast` which uses lite agent variants with strict token budgets.

## Token Budget Notes

All agents now have token budget guidance. Expected consumption per agent:
- news-researcher: ~25-35k tokens
- data-researcher: ~20-30k tokens
- expert-opinion-researcher: ~20-30k tokens
- historical-precedent-researcher: ~20-25k tokens
- contrarian-researcher: ~20-25k tokens
- official-docs-researcher: ~20-25k tokens
- social-media-researcher: ~15-20k tokens
- financial-markets-researcher: ~15-20k tokens
- web-search-researcher: ~15-20k tokens
- technical-researcher: ~15-20k tokens
