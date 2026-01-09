---
description: Fast, token-efficient prediction research using lite agents. ~50% less token usage than slim version. Uses 8 agents with strict token budgets.
argument-hint: "<binary yes/no question about a real-world event>"
allowed-tools: Read, Write, Grep, Glob, Task, TodoWrite, WebSearch, WebFetch
model: opus
---

# Predict Outcome (Fast)

Token-optimized prediction research using lite agents. Designed for ~10-15k tokens per agent (vs 40-100k in full version).

## Key Differences from /predict_outcome_slim

| Aspect | /predict_outcome_slim | /predict_outcome_fast |
|--------|----------------------|----------------------|
| Agents | 10 full agents | 8 lite agents |
| Token/agent | 40-100k | 10-15k |
| Sources/agent | 15-20 | 5-8 |
| Total tokens | ~500-800k | ~100-150k |
| Output | Comprehensive | Focused |

## Probability Buckets

| Bucket | Range | Meaning |
|--------|-------|---------|
| **near zero** | 0-5% | No credible path to YES |
| **very low** | 5-15% | Major obstacles, requires surprises |
| **low** | 15-30% | Meaningful obstacles exist |
| **medium** | 30-50% | Genuinely uncertain |
| **high** | 50-70% | More likely than not |
| **very high** | 70-85% | Likely, obstacles would need to emerge |
| **near 100** | 85-100% | Nearly inevitable |

## Your Process

### Step 1: Parse the Question

Extract:
1. **The Outcome**: What specific event are we predicting?
2. **YES means**: Definition of YES
3. **NO means**: Definition of NO
4. **Timeframe**: By when?

If ambiguous, ask for clarification.

### Step 2: Create Research Plan

Use TodoWrite:
```
1. Parse question - [in_progress]
2. Wave 1: News + Data + Expert (3 lite agents) - [pending]
3. Wave 2: Historical + Contrarian + Official (3 lite agents) - [pending]
4. Wave 3: Web + Social/Financial (2 lite agents) - [pending]
5. Synthesize findings - [pending]
6. Assign probability bucket - [pending]
7. Generate summary document - [pending]
```

### Step 3: Execute Research in Waves

**CRITICAL**: Use `-lite` agent variants. These have strict token budgets.

---

#### WAVE 1: Core Research (3 agents)

Spawn IN PARALLEL:

**Agent 1: news-researcher-lite**
```
Task with subagent_type="news-researcher-lite":

Research current news about: [TOPIC]

Question: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]
Timeframe: [timeframe]

Focus: Current situation, recent developments, upcoming events.
Budget: 5-8 sources max, 500-800 word output.
```

**Agent 2: data-researcher-lite**
```
Task with subagent_type="data-researcher-lite":

Research quantitative data about: [TOPIC]

Question: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]

Focus: Prediction market odds (Polymarket/Metaculus), key statistics.
Budget: Focus on 2-3 highest-signal data sources.
```

**Agent 3: expert-opinion-researcher-lite**
```
Task with subagent_type="expert-opinion-researcher-lite":

Research expert opinions about: [TOPIC]

Question: "[FULL QUESTION]"
YES means: [definition]
NO means: [definition]

Focus: 3-5 named experts with credentials, consensus vs dissent.
Budget: Quality over quantity, 400-600 word output.
```

**WAIT for Wave 1 to complete.**

---

#### WAVE 2: Deep Analysis (3 agents)

Spawn IN PARALLEL:

**Agent 4: historical-precedent-researcher-lite**
```
Task with subagent_type="historical-precedent-researcher-lite":

Research historical precedents for: [TOPIC]

Question: "[FULL QUESTION]"

Focus: 2-3 closest historical parallels, base rate if calculable.
Budget: 300-500 word output.
```

**Agent 5: contrarian-researcher-lite**
```
Task with subagent_type="contrarian-researcher-lite":

Research reasons [OUTCOME] will NOT happen: [TOPIC]

Question: "[FULL QUESTION]"
Expected outcome based on Wave 1: [LEANING]

Focus: Find the 3-5 strongest counter-arguments. Be genuinely adversarial.
Budget: 300-500 word output.
```

**Agent 6: official-docs-researcher-lite**
```
Task with subagent_type="official-docs-researcher-lite":

Research official documents about: [TOPIC]

Question: "[FULL QUESTION]"

Focus: 1-2 key government/regulatory sources if relevant.
Budget: Skip if no relevant official docs exist.
```

**WAIT for Wave 2 to complete.**

---

#### WAVE 3: Supplementary (2 agents)

Spawn IN PARALLEL:

**Agent 7: web-search-researcher-lite**
```
Task with subagent_type="web-search-researcher-lite":

Research additional context about: [TOPIC]

Question: "[FULL QUESTION]"

Focus: Fill gaps not covered by other agents.
Budget: 200-400 words, skip if well-covered.
```

**Agent 8: Choose based on topic relevance:**

If financial/economic topic → **financial-markets-researcher-lite**
If public sentiment matters → **social-media-researcher-lite**
If technical factors exist → **technical-researcher-lite**

```
Task with subagent_type="[chosen-lite-agent]":

Research [relevant aspect] about: [TOPIC]

Question: "[FULL QUESTION]"

Focus: Quick supplementary data only.
Budget: 150-300 words.
```

**WAIT for Wave 3 to complete.**

---

### Step 4: Synthesize (Briefly)

Compile from all 8 agents:
- **Top 3 evidence for YES**
- **Top 3 evidence for NO**
- **Prediction market odds**
- **Expert consensus**
- **Base rate** (if found)

### Step 5: Assign Probability Bucket

Use evidence weighting:
| Source Type | Weight |
|-------------|--------|
| Prediction markets | High |
| Official data | High |
| Expert consensus | Medium-High |
| Historical base rates | Medium |
| News/sentiment | Medium-Low |

**Tie-breaking**: Defer to prediction markets → base rates → expert consensus

### Step 6: Generate Summary Document

Save to: `thoughts/shared/research/YYYY-MM-DD-prediction-fast-[topic-slug].md`

**Keep it concise** - this is the fast version:

```markdown
---
type: prediction-research-fast
question: "[Question]"
probability_bucket: "[bucket]"
research_date: "YYYY-MM-DD"
execution_mode: fast (8 lite agents)
---

# Fast Prediction: [Question]

## Result
**Probability Bucket**: **[BUCKET]**
**One-Line Summary**: [One sentence]

## Key Evidence

### For YES
1. [Evidence] — *[Source]*
2. [Evidence] — *[Source]*
3. [Evidence] — *[Source]*

### For NO
1. [Evidence] — *[Source]*
2. [Evidence] — *[Source]*
3. [Evidence] — *[Source]*

## Data Points
- **Prediction Markets**: [Polymarket/Metaculus odds]
- **Expert Consensus**: [Summary]
- **Historical Base Rate**: [If found]

## Wave Summaries

### Wave 1: Current State
**News**: [2-3 sentences]
**Data**: [Key numbers]
**Experts**: [Consensus view]

### Wave 2: Deep Analysis
**Historical**: [Key precedents]
**Contrarian**: [Main counter-arguments]
**Official**: [Key official position]

### Wave 3: Supplementary
[Brief additional context]

## Probability Reasoning
[3-5 sentences: why this bucket]

---
*Fast prediction using 8 lite agents with token budgets*
```

### Step 7: Present Result

```markdown
## Fast Prediction Complete

**Question**: [Question]
**Probability Bucket**: **[BUCKET]**

### Summary
[2-3 sentences]

### Key Numbers
- Prediction Markets: [%]
- Expert Consensus: [view]
- Base Rate: [% if found]

### Top Evidence
**For YES**: [Top point]
**For NO**: [Top counter-argument]

---
**Mode**: Fast (8 lite agents, ~100-150k tokens)
**Document**: `thoughts/shared/research/YYYY-MM-DD-prediction-fast-[topic].md`
```

## Agent Summary

| Wave | Agents | Token Budget |
|------|--------|--------------|
| 1 | news-lite, data-lite, expert-lite | ~15k each |
| 2 | historical-lite, contrarian-lite, official-lite | ~12k each |
| 3 | web-lite + context-specific | ~8k each |

**Total expected**: ~100-150k tokens (vs ~500-800k for full version)
