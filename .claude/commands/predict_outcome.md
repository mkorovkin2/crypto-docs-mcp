---
description: Deep research on binary outcome predictions using 10 specialized agents. Provides probability bucket and comprehensive research summary with citations.
argument-hint: "<binary yes/no question about a real-world event>"
allowed-tools: Read, Write, Grep, Glob, Task, TodoWrite, WebSearch, WebFetch
model: opus
---

# Predict Outcome

Perform extremely thorough, multi-agent research on a binary outcome prediction (yes/no question about a real-world event). This command spawns 10 specialized research agents in parallel, each focused on different research angles, then synthesizes findings into a probability bucket with comprehensive citations.

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
/predict_outcome "Will the Fed cut interest rates in Q1 2025?"
/predict_outcome "Will Ukraine recapture Crimea by end of 2025?"
/predict_outcome "Will Congress pass comprehensive immigration reform before 2027?"
/predict_outcome "Will Tesla stock exceed $500 by December 2025?"
```

## Your Process

### Step 1: Parse the Question

Extract and clarify:
1. **The Outcome**: What specific event/state are we predicting?
2. **YES means**: Exact definition of what counts as YES
3. **NO means**: Exact definition of what counts as NO
4. **Timeframe**: By when? (If not specified, ask)
5. **Key Entities**: People, organizations, places involved
6. **Research Angles**: What types of research are most relevant?

If the question is ambiguous, ask for clarification:
- "What exactly counts as [outcome]?"
- "By what date?"
- "Which specific [entity] are you referring to?"

### Step 2: Create Research Plan

Use TodoWrite to create a research tracking list:

```
1. Parse and clarify question - [in_progress]
2. Spawn all research agents - [pending]
3. Wait for agent results - [pending]
4. Synthesize findings - [pending]
5. Assign probability bucket - [pending]
6. Generate research document - [pending]
7. Present summary to user - [pending]
```

### Step 3: Spawn Research Agents (ALL IN PARALLEL)

Spawn ALL 10 research agents simultaneously. Each agent will research deeply and return a comprehensive summary. This preserves context while maximizing research depth.

**CRITICAL**: Spawn all agents in a SINGLE message with multiple Task tool calls. Do NOT spawn them sequentially.

#### Agent 1: news-researcher
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
- What are officials/key figures saying?

## Requirements
- Follow your token budget guidance (~25-35k tokens)
- Include Reuters, AP, BBC, major newspapers
- Cite every source with full URL
- Build a timeline of recent events
```

#### Agent 2: historical-precedent-researcher
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
- What factors determined outcomes?
- Calculate base rates if possible

## Requirements
- Find at least 3-5 relevant precedents
- Include academic/archival sources
- Calculate explicit base rates where possible
- Note key differences from current situation
```

#### Agent 3: expert-opinion-researcher
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
- What are prediction markets showing?
- Where do experts disagree?

## Requirements
- Find named experts with credentials
- Include think tank reports
- Check Metaculus, Polymarket, PredictIt
- Document both consensus and dissent
```

#### Agent 4: official-docs-researcher
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
- Official statistics and data
- Legislative text if relevant

## Requirements
- DOWNLOAD AND READ actual PDFs
- Go to primary sources, not news summaries
- Include .gov sources
- Quote exact text with page numbers where possible
- Focus on official positions and facts
```

#### Agent 5: data-researcher
```
Task with subagent_type="data-researcher":

Research quantitative data and statistics about: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]

## Your Focus
- Polling data (if political)
- Prediction market odds
- Economic/statistical data
- Measurable indicators
- Trends over time

## Requirements
- Note sample sizes and margins of error
- Include multiple data sources
- Show historical trends
- Get current prediction market prices
```

#### Agent 6: contrarian-researcher
```
Task with subagent_type="contrarian-researcher":

Research reasons why [OUTCOME] will NOT happen: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
The expected/consensus outcome appears to be: [LEANING]

## Your ONLY Job
Find reasons this prediction will be WRONG. You are the devil's advocate.

## Your Focus
- What obstacles exist?
- Who opposes this and why?
- What similar predictions failed?
- What assumptions could be wrong?
- What could go wrong?

## Requirements
- Be genuinely adversarial
- Find real skeptics and critics
- Document historical failures
- Identify specific obstacles
- Present the strongest case AGAINST
```

#### Agent 7: social-media-researcher
```
Task with subagent_type="social-media-researcher":

Research social media sentiment and public discourse about: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]

## Your Focus
- What is public sentiment?
- Who are influential voices?
- Are there grassroots movements?
- What narratives are spreading?
- What's trending/viral?

## Requirements
- Search Twitter/X, Reddit, YouTube
- Find influential accounts and posts
- Assess sentiment (pro/anti/mixed)
- Note any organizing activity
- Link to specific posts where possible
```

#### Agent 8: financial-markets-researcher
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
- What are yields/currencies signaling?
- What are analysts saying?
- Are there prediction market contracts?

## Requirements
- Find relevant tickers and prices
- Check options implied volatility
- Look for analyst commentary
- Note any unusual market activity
- Include prediction market odds if available
```

#### Agent 9: web-search-researcher (existing)
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
- Deep-dive articles and explainers

## Requirements
- Search broadly across the web
- Find quality analysis pieces
- Include diverse perspectives
- Cite all sources
```

#### Agent 10: technical-researcher (existing)
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
- Expert technical analysis

## Requirements
- Focus on technical/domain expertise
- Find authoritative technical sources
- Include relevant documentation
- Cite all sources
```

### Step 4: Wait for All Results

Wait for ALL 10 agents to complete before proceeding. Do NOT start synthesis until you have all results.

Update your todo list as agents complete.

### Step 5: Synthesize Findings

Once all agents return, synthesize:

#### 5a: Compile Evidence For YES
List all evidence supporting the outcome happening:
- From each agent
- With source citations
- Weighted by source authority

#### 5b: Compile Evidence For NO
List all evidence against the outcome:
- From contrarian researcher especially
- From other agents' caveats
- With source citations

#### 5c: Assess Base Rates
From historical-precedent-researcher:
- What's the historical base rate?
- How does current situation compare?

#### 5d: Check Market/Expert Consensus
From data-researcher and expert-opinion-researcher:
- What do prediction markets say?
- What do experts predict?
- Is there consensus or disagreement?

#### 5e: Weight the Evidence

**Evidence Weighting Framework:**

| Source Type | Weight |
|-------------|--------|
| Official government documents/data | Highest |
| Court rulings/legal filings | Highest |
| Academic/peer-reviewed research | High |
| Reputable news (Reuters, AP, BBC) | High |
| Expert opinion (credentialed) | Medium-High |
| Prediction markets | Medium |
| Think tank analysis | Medium |
| Quality journalism | Medium |
| Social media sentiment | Low-Medium |
| Opinion/commentary | Low |

### Step 6: Assign Probability Bucket

Using the synthesized evidence, assign ONE bucket:

**near zero** - Choose if:
- No credible path to YES
- Overwhelming evidence against
- Would require multiple miracles
- Historical base rate ~0%

**very low** - Choose if:
- Major structural obstacles
- Would require significant surprises
- Most evidence points to NO
- Historical base rate <15%

**low** - Choose if:
- Meaningful obstacles exist
- Evidence leans toward NO
- Some path to YES but unlikely
- Historical base rate 15-30%

**medium** - Choose if:
- Evidence genuinely balanced
- Significant uncertainty
- Experts/markets divided
- Historical base rate ~50%

**high** - Choose if:
- Evidence leans toward YES
- Clear path exists
- Obstacles seem surmountable
- Historical base rate 50-70%

**very high** - Choose if:
- Strong evidence for YES
- Obstacles would need to emerge
- Expert/market consensus for YES
- Historical base rate >70%

**near 100** - Choose if:
- Outcome nearly inevitable
- Hard to see how it fails
- Would require major reversal
- Historical base rate ~100%

**Tie-Breaking Rules:**
1. When uncertain, defer to base rates
2. When base rates unavailable, defer to prediction markets
3. When markets thin/unavailable, defer to expert consensus
4. Always give extra weight to contrarian findings
5. Prefer medium over extreme buckets when evidence is mixed

### Step 7: Generate Research Document

Create a comprehensive research document at:
`thoughts/shared/research/YYYY-MM-DD-prediction-[topic-slug].md`

**CRITICAL: WRITE IN PARTS TO AVOID TOKEN LIMITS**

The research document will be large. To avoid output token limits and write failures:

1. **Write the document in sequential parts** using multiple Write/Edit tool calls
2. **Part 1**: Write frontmatter + Executive Summary + Methodology
3. **Part 2**: Write Detailed Findings sections 1-4
4. **Part 3**: Write Detailed Findings sections 5-9
5. **Part 4**: Write Evidence Synthesis + Probability Assessment
6. **Part 5**: Write Full Citation List

**Example approach:**
```
# First write call - create file with Part 1
Write(file_path, content="---\nfrontmatter...\n## Executive Summary\n...")

# Subsequent calls - append remaining parts
Edit(file_path, old_string="[END PART 1]", new_string="## Detailed Findings\n...[END PART 2]")
# OR use Write to append sections
```

**DO NOT** attempt to write the entire document in a single tool call - it will fail or truncate.

Use this template:

```markdown
---
type: prediction-research
question: "[Original question]"
probability_bucket: "[bucket]"
research_date: "YYYY-MM-DD"
total_sources: [count all unique sources from all agents]
agents_used: 10
---

# Prediction Research: [Question]

## Executive Summary

**Question**: [Full question]

**Probability Bucket**: **[BUCKET]**

**One-Line Summary**: [One sentence capturing the key finding]

### Key Evidence For YES
1. [Evidence point] — *[Source]*
2. [Evidence point] — *[Source]*
3. [Evidence point] — *[Source]*

### Key Evidence For NO
1. [Evidence point] — *[Source]*
2. [Evidence point] — *[Source]*
3. [Evidence point] — *[Source]*

### Critical Uncertainties
- [Uncertainty 1]
- [Uncertainty 2]

---

## Research Methodology

**Agents Deployed**: 10 specialized research agents
**Research Date**: [Date]
**Total Sources Consulted**: [Count]

| Agent | Focus | Sources Found |
|-------|-------|---------------|
| news-researcher | Current events | [N] |
| historical-precedent-researcher | Past analogies | [N] |
| expert-opinion-researcher | Expert predictions | [N] |
| official-docs-researcher | Government/legal docs | [N] |
| data-researcher | Statistics/polls | [N] |
| contrarian-researcher | Counter-arguments | [N] |
| social-media-researcher | Public sentiment | [N] |
| financial-markets-researcher | Market signals | [N] |
| web-search-researcher | Broad context | [N] |
| technical-researcher | Domain expertise | [N] |

---

## Detailed Findings by Research Area

### 1. Current Situation & Recent Developments
*Source: news-researcher*

[Summarize news findings with inline citations]

**Key Recent Events:**
| Date | Event | Source |
|------|-------|--------|
| [Date] | [Event] | [Source] |

---

### 2. Historical Precedents & Base Rates
*Source: historical-precedent-researcher*

[Summarize historical findings]

**Relevant Precedents:**
| Case | Outcome | Similarity | Source |
|------|---------|------------|--------|
| [Case] | [Outcome] | [High/Med/Low] | [Source] |

**Calculated Base Rate**: [X]% based on [N] similar cases

---

### 3. Expert Analysis & Predictions
*Source: expert-opinion-researcher*

[Summarize expert findings]

**Expert Predictions:**
| Expert | Affiliation | Prediction | Source |
|--------|-------------|------------|--------|
| [Name] | [Institution] | [Prediction] | [Source] |

**Prediction Market Data:**
| Platform | Odds | Volume | Date |
|----------|------|--------|------|
| Polymarket | [X]% | $[X] | [Date] |
| Metaculus | [X]% | [N forecasters] | [Date] |

---

### 4. Official Documents & Government Sources
*Source: official-docs-researcher*

[Summarize official document findings]

**Key Official Documents:**
| Document | Source | Date | Key Finding |
|----------|--------|------|-------------|
| [Title] | [Agency] | [Date] | [Finding] |

---

### 5. Quantitative Data & Statistics
*Source: data-researcher*

[Summarize data findings]

**Key Metrics:**
| Metric | Value | Trend | Source |
|--------|-------|-------|--------|
| [Metric] | [Value] | [Up/Down/Stable] | [Source] |

---

### 6. Contrarian Analysis (The Case for NO)
*Source: contrarian-researcher*

[Summarize contrarian findings - give this significant space]

**Major Obstacles:**
1. [Obstacle] — [Why it matters] — *[Source]*
2. [Obstacle] — [Why it matters] — *[Source]*

**Historical Failures:**
| Similar Prediction | What Happened | Why It Failed |
|--------------------|---------------|---------------|
| [Prediction] | [Outcome] | [Reason] |

**Strongest Counter-Argument:**
> [The best argument that this prediction is wrong]

---

### 7. Social Media & Public Sentiment
*Source: social-media-researcher*

[Summarize social media findings]

**Sentiment Assessment**: [Positive/Negative/Mixed/Divided]

---

### 8. Financial Market Signals
*Source: financial-markets-researcher*

[Summarize market findings]

**Market Indicators:**
| Indicator | Value | Signal |
|-----------|-------|--------|
| [Indicator] | [Value] | [Interpretation] |

---

### 9. Additional Context
*Sources: web-search-researcher, technical-researcher*

[Summarize additional findings]

---

## Evidence Synthesis

### Factors Favoring YES

| Factor | Weight | Evidence | Source |
|--------|--------|----------|--------|
| [Factor] | [High/Med/Low] | [Evidence] | [Source] |

### Factors Favoring NO

| Factor | Weight | Evidence | Source |
|--------|--------|----------|--------|
| [Factor] | [High/Med/Low] | [Evidence] | [Source] |

### Weight of Evidence Assessment

**Total Evidence Weight for YES**: [Assessment]
**Total Evidence Weight for NO**: [Assessment]
**Net Assessment**: [Leans YES / Leans NO / Balanced]

---

## Probability Assessment

### Bucket Assignment: **[BUCKET]**

**Reasoning**:
[2-3 paragraphs explaining why this bucket was chosen, referencing specific evidence]

**What Would Move This Higher**:
- [Factor that would increase probability]
- [Factor that would increase probability]

**What Would Move This Lower**:
- [Factor that would decrease probability]
- [Factor that would decrease probability]

**Confidence in Assessment**: [High/Medium/Low]
**Why**: [Brief explanation]

---

## Full Citation List

### News Sources
1. [Full citation with URL]
2. [Full citation with URL]

### Official Documents
1. [Full citation with URL]
2. [Full citation with URL]

### Expert Sources
1. [Full citation with URL]
2. [Full citation with URL]

### Data Sources
1. [Full citation with URL]
2. [Full citation with URL]

### Other Sources
1. [Full citation with URL]
2. [Full citation with URL]

---

*Research conducted on [Date] using 10 specialized research agents. Total sources consulted: [N].*
```

### Step 8: Present Summary to User

After saving the research document, present a concise summary:

```markdown
## Prediction Analysis Complete

**Question**: [Question]

**Probability Bucket**: **[BUCKET]**

### Summary
[2-3 sentence summary of findings]

### Top Evidence For YES
1. [Point with source]
2. [Point with source]
3. [Point with source]

### Top Evidence For NO
1. [Point with source]
2. [Point with source]
3. [Point with source]

### Key Data Points
- **Prediction Markets**: [Polymarket X%, Metaculus X%]
- **Expert Consensus**: [Summary]
- **Historical Base Rate**: [X%]

### Critical Uncertainty
[The one thing that could most change this assessment]

---

**Full research document saved to**: `thoughts/shared/research/YYYY-MM-DD-prediction-[topic].md`

**Sources consulted**: [N] across 10 research agents
```

## Example Session

**User**: `/predict_outcome "Will the UK rejoin the EU by 2030?"`

**You**:

1. Parse: Question is about UK-EU relationship, YES = formal EU membership, NO = not a member, Timeframe = by end of 2030

2. Create todo list tracking research

3. Spawn ALL 10 agents simultaneously with customized prompts

4. Wait for all results (this may take several minutes)

5. Synthesize: Compile evidence for rejoining (Labour government, public opinion shift, economic pressure) vs against (political toxicity, EU reluctance, constitutional hurdles)

6. Assign bucket: Likely "very low" or "low" given structural obstacles

7. Generate research document with all findings and citations

8. Present summary with probability bucket and key evidence

## Important Guidelines

1. **Be Thorough**: This is deep research. 10 agents, 100+ sources expected.

2. **Be Skeptical**: Weight contrarian findings heavily. Consensus is often wrong.

3. **Cite Everything**: Every claim needs a source. No assertions without evidence.

4. **Use Buckets, Not Numbers**: Never give specific percentages. Use the 7 buckets.

5. **Save the Research**: Always save the full document to thoughts/shared/research/

6. **Context Management**: Agents do heavy lifting. You synthesize summaries.

7. **Acknowledge Uncertainty**: When evidence is mixed, say so. Don't fake confidence.

8. **Update Research**: If user asks follow-up, you can spawn additional agents or update the document.

## Comparison to Other Variants

| Aspect | /predict_outcome | /predict_outcome_slim | /predict_outcome_fast | /predict_outcome_heavy |
|--------|------------------|----------------------|----------------------|------------------------|
| Parallel agents | **10 at once** | 3 max | 3 max | 3 max |
| Total agents | 10 | 10 | 8 lite | 13 |
| Token budget/agent | ~25-35k | ~20-35k | ~10-15k | ~20-35k |
| Total tokens | ~250-350k | ~200-350k | ~100-150k | ~300-450k |
| Speed | **Fastest** | Slower | Medium | Slowest |
| Thoroughness | High | High | Good | Highest |

## Token Budget Notes

All agents now have token budget guidance. Expected consumption:
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

**For lower token usage**: Use `/predict_outcome_fast` (8 lite agents, ~100-150k total tokens)
