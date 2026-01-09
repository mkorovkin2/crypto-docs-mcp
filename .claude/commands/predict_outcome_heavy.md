---
description: Heavy version of predict_outcome - includes all standard research PLUS deep analysis of famous/notable similar cases for comparison-based prediction.
argument-hint: "<binary yes/no question about a real-world event>"
allowed-tools: Read, Write, Grep, Glob, Task, TodoWrite, WebSearch, WebFetch
model: opus
---

# Predict Outcome (Heavy)

Enhanced version of `/predict_outcome_slim` that adds a dedicated phase for researching famous/notable cases similar to the prediction question. Uses case comparison methodology to strengthen predictions.

**Total: 13 agents across 5 waves (3 agents max per wave)**

## What Makes This "Heavy"

In addition to all standard research, this command:
1. **Finds famous similar cases** - Well-known historical events that mirror the current question
2. **Deep-dives each case** - Analyzes what happened and why
3. **Compares to current situation** - Systematic comparison of factors
4. **Draws lessons** - What famous cases teach us about likely outcomes

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
/predict_outcome_heavy "Will the Supreme Court overturn Chevron deference?"
/predict_outcome_heavy "Will there be a major US bank failure in 2025?"
/predict_outcome_heavy "Will the UK hold a referendum on rejoining the EU by 2030?"
```

## Your Process

### Step 1: Parse the Question

Extract and clarify:
1. **The Outcome**: What specific event/state are we predicting?
2. **YES means**: Exact definition of what counts as YES
3. **NO means**: Exact definition of what counts as NO
4. **Timeframe**: By when? (If not specified, ask)
5. **Key Entities**: People, organizations, places involved
6. **Case Category**: What type of event is this? (political, legal, economic, social, international)

If the question is ambiguous, ask for clarification.

### Step 2: Create Research Plan

Use TodoWrite to track progress through all 5 waves:

```
1. Parse and clarify question - [in_progress]
2. Wave 1: News + Data + Expert agents - [pending]
3. Wave 2: Historical + Official Docs + Contrarian agents - [pending]
4. Wave 3: Social Media + Financial + Web Search agents - [pending]
5. Wave 4: Technical researcher - [pending]
6. Wave 5: Famous Cases research (3 agents) - [pending]
7. Synthesize findings + case comparison - [pending]
8. Assign probability bucket - [pending]
9. Generate research document - [pending]
```

### Step 3: Execute Research in Waves

**CRITICAL**: Only spawn 3 agents at a time. Wait for each wave to complete before starting the next.

---

#### WAVE 1: Current State & Data (3 agents)

Spawn these 3 agents IN PARALLEL:

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
- Follow your token budget guidance (~25-35k tokens)
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
```

**WAIT for all 3 agents to complete before proceeding.**

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
- Follow your token budget guidance (~20-25k tokens)
- Find 3-5 strong precedents
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

## Requirements
- DOWNLOAD AND READ actual PDFs
- Go to primary sources
```

**Agent 6: contrarian-researcher**
```
Task with subagent_type="contrarian-researcher":

Research reasons why [OUTCOME] will NOT happen: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
The expected/consensus outcome appears to be: [LEANING based on Wave 1]

## Your ONLY Job
Find reasons this prediction will be WRONG.

## Requirements
- Be genuinely adversarial
- Find real skeptics and critics
```

**WAIT for all 3 agents to complete before proceeding.**

---

#### WAVE 3: Sentiment & Markets (3 agents)

Spawn these 3 agents IN PARALLEL:

**Agent 7: social-media-researcher**
```
Task with subagent_type="social-media-researcher":

Research social media sentiment about: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"

## Your Focus
- What is public sentiment?
- Who are influential voices?
- What narratives are spreading?
```

**Agent 8: financial-markets-researcher**
```
Task with subagent_type="financial-markets-researcher":

Research financial market signals about: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"

## Your Focus
- What are affected stocks/sectors doing?
- What do options markets imply?
- What are analysts saying?
```

**Agent 9: web-search-researcher**
```
Task with subagent_type="web-search-researcher":

Conduct broad web research about: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"

## Your Focus
- General background and context
- Perspectives not covered by other agents
- International viewpoints
```

**WAIT for all 3 agents to complete before proceeding.**

---

#### WAVE 4: Technical Deep Dive (1 agent)

**Agent 10: technical-researcher**
```
Task with subagent_type="technical-researcher":

Research technical/domain-specific aspects of: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"

## Your Focus
- Domain-specific technical details
- Technical constraints or enablers
```

**WAIT for agent to complete before proceeding.**

---

#### WAVE 5: FAMOUS CASES ANALYSIS (3 agents) - THE HEAVY ADDITION

This wave is what makes this the "heavy" version. We research famous/notable cases similar to our prediction question.

**Agent 11: web-search-researcher** (Famous Cases Discovery)
```
Task with subagent_type="web-search-researcher":

Find FAMOUS and NOTABLE cases similar to: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"
This is a [CATEGORY] type question (political/legal/economic/social/international)

## Your SPECIFIC Job
Find 5-10 FAMOUS, WELL-KNOWN cases that are similar to this prediction question. We want cases that:
- Are widely studied and discussed
- Have clear outcomes we can learn from
- Are frequently cited as precedents or comparisons
- Made headlines or are in textbooks

## Search Strategy
Search for:
- "famous [category] cases similar to [topic]"
- "notable examples of [type of event]"
- "landmark [category] cases"
- "[topic] compared to" OR "[topic] similar to"
- "lessons from [related historical events]"
- "[type of outcome] famous examples history"

## Output Required
For EACH famous case found:
1. **Case Name**: The commonly known name
2. **Year/Period**: When it happened
3. **Brief Description**: 2-3 sentences on what happened
4. **Outcome**: How it resolved
5. **Why It's Famous**: Why this case is notable/studied
6. **Similarity to Current Question**: How it relates to our prediction
7. **Source**: URL where you found information

Find at least 5 famous cases. More is better.
```

**Agent 12: historical-precedent-researcher** (Famous Cases Deep Analysis)
```
Task with subagent_type="historical-precedent-researcher":

Deep-dive analysis of famous cases related to: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"

## Your SPECIFIC Job
For the type of event we're predicting, find and DEEPLY ANALYZE the most famous historical cases. We want:

### For Each Famous Case:
1. **Full Context**: What was happening before this event?
2. **Key Actors**: Who were the main players?
3. **Critical Factors**: What determined the outcome?
4. **Turning Points**: What moments changed everything?
5. **What Experts Predicted**: Did experts predict correctly?
6. **Surprises**: What was unexpected?
7. **Aftermath**: What happened as a result?

### Search Focus
- Academic analyses of famous [category] cases
- Books and papers written about landmark events
- "Case study" + [type of event]
- Historical analysis of famous precedents

## Output Format
Provide detailed analysis (500+ words per case) for at least 3 major famous cases.
```

**Agent 13: expert-opinion-researcher** (Famous Cases Comparison)
```
Task with subagent_type="expert-opinion-researcher":

Find expert comparisons between current situation and famous historical cases: [TOPIC]

## Question Context
The prediction question is: "[FULL QUESTION]"

## Your SPECIFIC Job
Find what EXPERTS say about how the current situation compares to famous historical cases. We want:

1. **Expert Comparisons**: Who has compared this to historical cases?
2. **Which Cases Are Cited**: What famous cases do experts reference?
3. **Similarities They Note**: What parallels do experts draw?
4. **Differences They Note**: Where do experts say it's different?
5. **Lessons They Draw**: What do experts say we should learn?
6. **Predictions Based on Comparison**: Do experts predict based on historical comparison?

### Search Strategy
- "[topic] compared to [famous case]"
- "[topic] similar to [historical event]"
- "experts compare [topic] to"
- "[topic] lessons from history"
- "[topic] echoes of [past event]"
- "[analyst/expert name] [topic] historical comparison"

## Output Required
- Find at least 5 expert comparisons
- Include the expert's name and credentials
- Quote their specific comparison
- Note which famous cases they cite
```

**WAIT for all 3 agents to complete.**

---

### Step 4: Build Case Comparison Matrix

After Wave 5 completes, build a structured comparison:

#### 4a: List All Famous Cases Found

From Waves 4 and 5, compile all famous cases:

| Case Name | Year | Category | Outcome | Similarity Score |
|-----------|------|----------|---------|------------------|
| [Case 1] | [Year] | [Type] | [YES/NO equivalent] | [High/Med/Low] |
| [Case 2] | [Year] | [Type] | [YES/NO equivalent] | [High/Med/Low] |

#### 4b: Factor-by-Factor Comparison

For each key factor, compare current situation to famous cases:

| Factor | Current Situation | Famous Case A | Famous Case B | Famous Case C |
|--------|-------------------|---------------|---------------|---------------|
| [Factor 1] | [Current] | [Case A value] | [Case B value] | [Case C value] |
| [Factor 2] | [Current] | [Case A value] | [Case B value] | [Case C value] |
| [Factor 3] | [Current] | [Case A value] | [Case B value] | [Case C value] |

#### 4c: Outcome Pattern Analysis

| Famous Case | Outcome | Key Success/Failure Factors | Present in Current? |
|-------------|---------|----------------------------|---------------------|
| [Case] | [Outcome] | [Factors] | [Yes/No/Partial] |

#### 4d: Famous Case Vote

Based on similarity, which outcome do famous cases suggest?

| Case | Similar? | Their Outcome | Suggests for Us |
|------|----------|---------------|-----------------|
| [Case 1] | High | YES | YES |
| [Case 2] | Medium | NO | (weak) NO |
| [Case 3] | High | YES | YES |

**Famous Cases Verdict**: [X] of [Y] similar cases had [OUTCOME]

### Step 5: Synthesize All Findings

Combine standard research with case comparison:

#### 5a: Standard Evidence (Waves 1-4)
- Evidence for YES
- Evidence for NO
- Base rates
- Market/Expert consensus

#### 5b: Famous Cases Evidence (Wave 5)
- What famous similar cases suggest
- How current situation compares to those cases
- Pattern across famous cases

#### 5c: Weight the Evidence

| Source Type | Weight |
|-------------|--------|
| Official government documents | Highest |
| Famous case comparisons (high similarity) | High |
| Academic research | High |
| Expert predictions | Medium-High |
| Famous case comparisons (medium similarity) | Medium |
| Prediction markets | Medium |
| Social media sentiment | Low-Medium |

### Step 6: Assign Probability Bucket

Consider both standard evidence AND famous case patterns:

**Bucket Assignment Framework:**

1. What do standard research sources suggest?
2. What do famous similar cases suggest?
3. How similar is our situation to those cases?
4. Where does case evidence diverge from other evidence?

If famous cases strongly diverge from current expert opinion, investigate WHY:
- Is the current situation genuinely different?
- Are experts ignoring historical patterns?
- Have conditions fundamentally changed?

### Step 7: Generate Research Document

Save to: `thoughts/shared/research/YYYY-MM-DD-prediction-heavy-[topic-slug].md`

**CRITICAL: WRITE IN PARTS TO AVOID TOKEN LIMITS**

The research document will be VERY large (13 agents + famous cases analysis). To avoid output token limits and write failures:

1. **Write the document in sequential parts** using multiple Write/Edit tool calls
2. **Part 1**: Write frontmatter + Executive Summary
3. **Part 2**: Write Part 1 - Standard Research Findings (Waves 1-2)
4. **Part 3**: Write Part 1 continued - Standard Research Findings (Waves 3-4)
5. **Part 4**: Write Part 2 - Famous Cases Identified (first half)
6. **Part 5**: Write Part 2 - Famous Cases Identified (second half) + Comparison Matrix
7. **Part 6**: Write Part 3 - Synthesis + Probability Assessment
8. **Part 7**: Write Full Citation List

**Example approach:**
```
# First write call - create file with Part 1
Write(file_path, content="---\nfrontmatter...\n## Executive Summary\n...\n\n<!-- CONTINUE -->")

# Subsequent calls - replace marker and add next section
Edit(file_path, old_string="<!-- CONTINUE -->", new_string="## Part 1: Standard Research\n...\n\n<!-- CONTINUE -->")
```

**DO NOT** attempt to write the entire document in a single tool call - it will fail or truncate.
**This is especially important for /predict_outcome_heavy due to the extensive famous cases analysis.**

```markdown
---
type: prediction-research-heavy
question: "[Original question]"
probability_bucket: "[bucket]"
research_date: "YYYY-MM-DD"
total_sources: [count]
agents_used: 13
execution_mode: heavy (5 waves, famous cases analysis)
famous_cases_analyzed: [count]
---

# Prediction Research (Heavy): [Question]

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

### What Famous Cases Suggest
**Cases Analyzed**: [List]
**Pattern**: [X of Y similar cases resulted in [OUTCOME]]
**Most Similar Case**: [Case name] → [Their outcome]

---

## Part 1: Standard Research Findings

### Wave 1: Current State & Data
[News, Data, Expert findings]

### Wave 2: Historical & Official
[Historical precedents, Official docs, Contrarian findings]

### Wave 3: Sentiment & Markets
[Social media, Financial markets, Broad web findings]

### Wave 4: Technical
[Domain-specific findings]

---

## Part 2: Famous Cases Analysis

### Famous Cases Identified

#### Case 1: [Famous Case Name]
**Year**: [Year]
**Category**: [Political/Legal/Economic/Social/International]
**What Happened**: [Full description]
**Outcome**: [How it resolved]
**Why It's Famous**: [Why studied/cited]
**Key Success/Failure Factors**: [What determined outcome]
**Similarity to Current Question**: [High/Medium/Low]
**What This Case Suggests**: [Implication for our prediction]
**Sources**: [Citations]

#### Case 2: [Famous Case Name]
[Same structure...]

#### Case 3: [Famous Case Name]
[Same structure...]

[Continue for all cases...]

### Case Comparison Matrix

#### Factor-by-Factor Analysis

| Factor | Current | [Case 1] | [Case 2] | [Case 3] |
|--------|---------|----------|----------|----------|
| [Key factor 1] | [Status] | [Status] | [Status] | [Status] |
| [Key factor 2] | [Status] | [Status] | [Status] | [Status] |
| [Key factor 3] | [Status] | [Status] | [Status] | [Status] |
| **Outcome** | **?** | [Outcome] | [Outcome] | [Outcome] |

#### Similarity Scores

| Case | Similarity | Their Outcome | Weight |
|------|------------|---------------|--------|
| [Case 1] | [High/Med/Low] | [YES/NO] | [High/Med/Low] |
| [Case 2] | [High/Med/Low] | [YES/NO] | [High/Med/Low] |

#### Famous Cases Verdict
- **Total cases analyzed**: [N]
- **High-similarity cases**: [N]
- **Of high-similarity cases**: [X] resulted in YES, [Y] resulted in NO
- **Pattern suggests**: [YES/NO/MIXED]

### Expert Comparisons to Famous Cases
| Expert | Compared To | Their Assessment |
|--------|-------------|------------------|
| [Name] | [Case] | "[Quote]" |

### What Makes Current Situation Different
[Analysis of how current situation differs from famous cases]

### What Famous Cases Teach Us
1. [Lesson 1 with case reference]
2. [Lesson 2 with case reference]
3. [Lesson 3 with case reference]

---

## Part 3: Synthesis

### Evidence Summary

| Source | Suggests | Confidence |
|--------|----------|------------|
| Current news | [YES/NO/Mixed] | [High/Med/Low] |
| Expert opinion | [YES/NO/Mixed] | [High/Med/Low] |
| Prediction markets | [YES/NO/Mixed] | [High/Med/Low] |
| Historical base rate | [YES/NO/Mixed] | [High/Med/Low] |
| Famous cases pattern | [YES/NO/Mixed] | [High/Med/Low] |
| Contrarian analysis | [Obstacles] | [High/Med/Low] |

### Convergence/Divergence Analysis
**Where sources agree**: [Description]
**Where sources diverge**: [Description]
**Famous cases vs current consensus**: [How they compare]

---

## Probability Assessment

### Bucket: **[BUCKET]**

### Reasoning
[3-4 paragraphs explaining why this bucket, with explicit reference to:
- Standard evidence
- Famous case patterns
- How current situation compares to historical patterns
- Why we weighted evidence as we did]

### What Famous Cases Got Right/Wrong
[Did experts at the time predict famous cases correctly? What does this teach us?]

### What Would Move This Higher
- [Factor]
- [Factor]

### What Would Move This Lower
- [Factor]
- [Factor]

---

## Full Citation List

### News Sources
[...]

### Expert Sources
[...]

### Famous Case Sources
[...]

### Official Documents
[...]

---

*Research conducted using 13 agents across 5 waves. Famous cases analysis included [N] notable historical precedents.*
```

### Step 8: Present Summary

```markdown
## Prediction Analysis Complete (Heavy)

**Question**: [Question]
**Probability Bucket**: **[BUCKET]**

### Summary
[2-3 sentences including famous cases insight]

### Standard Evidence
**For YES**: [Top points]
**For NO**: [Top points]

### Famous Cases Analysis
**Cases Studied**: [List top 3-5]
**Pattern**: [X of Y] similar cases resulted in [OUTCOME]
**Most Instructive Case**: [Case name] - [Brief lesson]

### Key Data Points
- **Prediction Markets**: [Odds]
- **Historical Base Rate**: [%]
- **Famous Cases Pattern**: [X/Y] → [OUTCOME]

### Critical Insight from Famous Cases
[One key lesson from the case comparison]

---
**Execution**: 5 waves, 13 agents, famous cases analysis
**Full document**: `thoughts/shared/research/YYYY-MM-DD-prediction-heavy-[topic].md`
```

## Wave Summary

| Wave | Agents | Focus |
|------|--------|-------|
| 1 | news, data, expert | Current state & consensus |
| 2 | historical, official-docs, contrarian | Deep analysis & counter-arguments |
| 3 | social-media, financial, web-search | Sentiment & markets |
| 4 | technical | Domain expertise |
| **5** | **web-search, historical, expert** | **Famous cases discovery, analysis & comparison** |

## Comparison to Other Versions

| Aspect | /predict_outcome | /predict_outcome_slim | /predict_outcome_fast | /predict_outcome_heavy |
|--------|------------------|----------------------|----------------------|------------------------|
| Parallel agents | 10 at once | 3 max | 3 max | 3 max |
| Total agents | 10 | 10 | 8 lite | **13** |
| Waves | 1 | 4 | 3 | **5** |
| Token budget/agent | ~40-100k | ~20-35k | ~10-15k | ~20-35k |
| Total tokens | ~500-800k | ~200-350k | ~100-150k | ~300-450k |
| Famous cases | No | No | No | **Yes (dedicated wave)** |
| Case comparison | No | No | No | **Yes (structured)** |
| Thoroughness | High | High | Good | **Highest** |

## Token Budget Notes

All agents now have token budget guidance. Wave 5 (famous cases) reuses existing agents with their budgets:
- Waves 1-4: Same as /predict_outcome_slim (~20-35k per agent)
- Wave 5: Additional ~60-75k for famous cases analysis
