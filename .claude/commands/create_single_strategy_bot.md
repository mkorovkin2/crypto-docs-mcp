---
description: Creates a specialized Polymarket trading bot for a single strategy. Supports preset strategies OR custom user-defined strategies. Interrogates until full understanding, then researches, scaffolds, and audits.
argument-hint: "<strategy: market_maker|arbitrage|spike_detector|custom> [description]"
allowed-tools: Read, Write, Glob, Grep, Task, TodoWrite, AskUserQuestion, Skill
model: opus
---

# Create Single Strategy Bot

Create a complete, working Polymarket trading bot specialized for a single strategy.

**This command supports BOTH preset strategies AND custom user-defined strategies.**

For custom strategies, you MUST thoroughly interrogate the user until you have COMPLETE understanding of what they want. Never proceed with ambiguity.

## Strategy Types

### Preset Strategies
| Code | Description |
|------|-------------|
| `market_maker` | Two-sided quotes, spread capture |
| `arbitrage` | YES+NO pricing inefficiencies |
| `spike_detector` | React to sudden price movements |

### Custom Strategy
| Code | Description |
|------|-------------|
| `custom` | User-defined strategy - requires clarification |
| (anything else) | Treated as custom strategy description |

## How to Use

```
# Preset strategies
/create_single_strategy_bot market_maker
/create_single_strategy_bot arbitrage

# Custom strategies
/create_single_strategy_bot custom
/create_single_strategy_bot "buy when price drops 10% in 5 minutes"
/create_single_strategy_bot I want a bot that follows whale wallets
```

---

## Dynamic Skills Integration

### Crypto Short-Term Markets Skill

**When to Invoke**: Automatically invoke the `crypto-short-term-markets` skill when ANY of these conditions are detected:

1. **Strategy targets short-term crypto markets**:
   - User mentions "15-minute", "15 min", "hourly", "1-hour", or "short-term"
   - User mentions BTC/Bitcoin, ETH/Ethereum, or SOL/Solana markets
   - Strategy involves rapid-resolution predictions

2. **Keywords that trigger invocation**:
   - "crypto up/down markets"
   - "bitcoin/ethereum/solana predictions"
   - "quick resolution", "fast markets"
   - "15-minute arbitrage" or "hourly market making"

3. **Strategy types commonly requiring this skill**:
   - `spike_detector` targeting crypto
   - `market_maker` on 15-min/hourly crypto
   - `arbitrage` on short-term crypto markets
   - Custom strategies involving BTC/ETH/SOL timing

**How to Invoke**:

```
Use the Skill tool:
skill: "crypto-short-term-markets"
```

The skill will:
1. Research current BTC/ETH/SOL 15-minute and 1-hour market state
2. Gather market slugs, volume, liquidity data
3. Document API patterns and trading characteristics
4. Write findings to `thoughts/shared/crypto-markets-research.md`

**When to Invoke in Process**:
- Invoke BEFORE Step 6 (Research Agent) if crypto short-term markets are detected
- The research output will be available for the polymarket-researcher subagent
- Ensures the bot is configured with current market intelligence

**Example Integration**:

```
User: "/create_single_strategy_bot spike_detector for bitcoin 15-minute markets"

Process:
1. Parse strategy → spike_detector (preset)
2. Detect "bitcoin 15-minute markets" → INVOKE crypto-short-term-markets skill
3. Skill gathers current BTC 15-min market data
4. Continue to Step 3 (Confirm Understanding)
5. Reference skill output in strategy spec
6. Research agent reads both spec and crypto-markets-research.md
```

---

### Polymarket Fee Knowledge Skill

**When to Invoke**: Read the `polymarket-fee-knowledge` skill when ANY of these conditions are detected:

1. **Strategy targets 15-minute crypto markets** (BTC, ETH, SOL, XRP):
   - These are the ONLY markets with trading fees
   - Taker fees up to ~3% at 50% price
   - Makers earn rebates (negative fees)

2. **User asks about fees or costs**:
   - "What are the fees?"
   - "How do I calculate costs?"
   - "What's my break-even price?"

3. **Strategy involves market making**:
   - Maker rebates are highly relevant
   - Fee asymmetry affects profitability calculations

4. **Profitability or P&L calculations needed**:
   - Fees significantly impact short-term trading profits
   - Must account for buying vs selling fee differences

**Skill Location**: `.claude/skills/polymarket-fee-knowledge/SKILL.md`

**How to Use**:

```
Read the skill file to get:
- Official fee formulas from Polymarket docs
- Python PolymarketFeeCalculator class
- Maker rebate program details
- Fee impact tables by price
```

**Key Fee Facts (Quick Reference)**:

| Market Type | Maker Fee | Taker Fee |
|-------------|-----------|-----------|
| Most markets | 0% | 0% |
| 15-min crypto | 0% + rebates | Up to ~3% |

**Fee Formulas**:
- **Selling**: `feeQuote = baseRate × min(price, 1-price) × size` (USDC)
- **Buying**: `feeBase = baseRate × min(price, 1-price) × (size/price)` (tokens)

**API**: `GET https://clob.polymarket.com/fee-rate?token_id={token_id}` → returns 0 or 1000 bps

**Example Integration**:

```
User: "/create_single_strategy_bot market_maker for ETH 15-minute markets"

Process:
1. Parse strategy → market_maker (preset)
2. Detect "ETH 15-minute markets" →
   a. INVOKE crypto-short-term-markets skill
   b. READ polymarket-fee-knowledge skill
3. Include fee calculations in strategy spec
4. Scaffolder implements PolymarketFeeCalculator
5. Bot tracks maker rebates and net P&L
```

---

## YOUR PROCESS

### Step 1: Parse Strategy Input

Determine if this is a preset or custom strategy:

**If preset** (`market_maker`, `arbitrage`, `spike_detector`):
- Skip to Step 3 (you already understand the strategy)
- Use the standard strategy specification

**If custom** (anything else, including "custom"):
- Proceed to Step 2 (interrogation phase)
- You MUST fully understand before proceeding

**If no argument provided**:
Ask what strategy they want:
```
What trading strategy would you like to implement?

**Preset options:**
- `market_maker` - Two-sided quotes to capture spread
- `arbitrage` - Exploit YES+NO != $1.00 inefficiencies
- `spike_detector` - React to sudden price movements

**Or describe your custom strategy:**
Just tell me what you want the bot to do, and I'll ask clarifying questions.
```

---

### Step 2: Strategy Interrogation (CUSTOM STRATEGIES ONLY)

**THIS IS CRITICAL. DO NOT SKIP OR RUSH THIS STEP.**

For custom strategies, you must interrogate the user until you have COMPLETE clarity on:

#### 2.1: Core Logic Questions

Ask about the fundamental strategy:

1. **Entry Signal**: What triggers a buy?
   - Price-based? (crosses threshold, drops X%, etc.)
   - Time-based? (every N minutes, at market open, etc.)
   - Event-based? (news, whale activity, volume spike, etc.)
   - Combination?

2. **Exit Signal**: What triggers a sell/close?
   - Take profit target?
   - Stop loss?
   - Time-based exit?
   - Reversal signal?

3. **Position Sizing**: How much to trade?
   - Fixed amount per trade?
   - Percentage of portfolio?
   - Kelly criterion or other formula?
   - Maximum position size?

4. **Direction**: Which side(s)?
   - Only buy YES?
   - Only buy NO?
   - Both directions based on signal?

#### 2.2: Market Selection Questions

5. **Target Markets**: Which markets to trade?
   - Specific market(s) by name/ID?
   - Category-based? (politics, sports, crypto, etc.)
   - All markets meeting criteria?
   - Single market or multi-market?

6. **Market Filters**: Any requirements?
   - Minimum liquidity?
   - Minimum volume?
   - Time until resolution?
   - Price range requirements?

#### 2.3: Risk Management Questions

7. **Position Limits**: What constraints?
   - Max position per market?
   - Max total exposure?
   - Max daily loss?

8. **Error Handling**: What happens when things go wrong?
   - API errors - retry or stop?
   - Partial fills - accept or cancel?
   - Price slippage - tolerance?

#### 2.4: Operational Questions

9. **Frequency**: How often to run?
   - Continuous loop with interval?
   - On-demand/triggered?
   - Specific times?

10. **State Management**: What to track?
    - Open positions?
    - P&L history?
    - Trade log?

#### 2.5: Clarification Loop

**KEEP ASKING UNTIL EVERYTHING IS CLEAR.**

After initial questions, identify any ambiguities and ask follow-ups:

```
Before I proceed, I want to make sure I understand your strategy completely.

I still have questions about:
1. [Specific ambiguity]
2. [Another unclear point]
3. [Edge case not addressed]

Can you clarify these?
```

**DO NOT PROCEED UNTIL:**
- You can explain the strategy back to the user
- The user confirms your understanding is correct
- There are no "it depends" or "maybe" answers remaining

---

### Step 3: Confirm Understanding

**MANDATORY STEP - NEVER SKIP**

Write out your complete understanding and get explicit confirmation:

```markdown
## Strategy Confirmation

Let me confirm I understand your strategy correctly:

### Strategy Name
{Give it a descriptive name}

### Core Logic
**Entry**: {Exactly when to buy/enter}
**Exit**: {Exactly when to sell/exit}
**Direction**: {YES only / NO only / Both}

### Position Management
**Size**: {How much per trade}
**Max Position**: {Maximum exposure}
**Stop Loss**: {If any}
**Take Profit**: {If any}

### Target Markets
**Selection**: {How markets are chosen}
**Filters**: {Any requirements}

### Operational Details
**Frequency**: {How often the loop runs}
**Error Handling**: {What happens on errors}

### Edge Cases
- If [situation X]: {behavior}
- If [situation Y]: {behavior}

---

**Is this understanding correct?**

If anything is wrong or missing, please correct me before I proceed.
```

**WAIT FOR EXPLICIT "YES" CONFIRMATION.**

If the user corrects anything, update your understanding and confirm again.

---

### Step 4: Write Strategy Specification to Thoughts

Once confirmed, write the complete strategy specification to a thoughts file.

**This is how you hand off context to subagents.**

Create file: `thoughts/shared/polymarket-bot-specs/{timestamp}-{strategy-slug}.md`

```markdown
# Polymarket Bot Specification

## Metadata
- **Created**: {timestamp}
- **Strategy Type**: {preset or custom}
- **Strategy Name**: {descriptive name}
- **Confirmed By User**: Yes

## Strategy Specification

### Overview
{2-3 sentence description of what this bot does}

### Entry Logic
{Complete, unambiguous entry conditions}

**Trigger**: {What causes an entry}
**Side**: {BUY YES / BUY NO / Either based on condition}
**Confirmation Required**: {Any additional checks}

### Exit Logic
{Complete, unambiguous exit conditions}

**Take Profit**: {Target price or gain}
**Stop Loss**: {Maximum loss tolerance}
**Time Exit**: {If any time-based exit}
**Signal Exit**: {If any signal-based exit}

### Position Sizing
**Base Size**: {Amount per trade}
**Sizing Method**: {Fixed / Percentage / Formula}
**Maximum Position**: {Per market and total}

### Market Selection
**Target Markets**: {Specific markets or selection criteria}
**Filters**:
- Minimum Liquidity: {value or "none"}
- Minimum Volume: {value or "none"}
- Resolution Window: {requirements or "none"}
- Price Range: {requirements or "none"}

### Risk Management
**Max Loss Per Trade**: {value}
**Max Daily Loss**: {value or "none"}
**Max Concurrent Positions**: {number}
**Slippage Tolerance**: {percentage}

### Operational Parameters
**Loop Interval**: {seconds between iterations}
**Trading Hours**: {always or specific times}
**Error Recovery**: {retry policy}

### Edge Cases
{List all edge cases and how to handle them}

1. **{Edge case 1}**: {How to handle}
2. **{Edge case 2}**: {How to handle}
3. ...

### API Requirements
{Based on strategy, which APIs/methods are needed}

- **Price Data**: {endpoints needed}
- **Order Placement**: {endpoints needed}
- **Position Tracking**: {endpoints needed}

### Configuration Variables
{All configurable parameters for .env}

| Variable | Description | Default |
|----------|-------------|---------|
| {VAR_1} | {description} | {default} |
| {VAR_2} | {description} | {default} |
| ... | ... | ... |

---

## User Confirmation
The user has confirmed this specification is correct and complete.
```

---

### Step 5: Create Progress Tracking

Use TodoWrite:

```
1. Parse strategy input - [completed]
2. Interrogate and clarify (if custom) - [completed]
3. Confirm understanding with user - [completed]
4. Write strategy spec to thoughts - [completed]
5. Invoke crypto-short-term-markets skill (if applicable) - [pending/skip]
6. Research strategy implementation - [in_progress]
7. Scaffold bot project - [pending]
8. Audit bot implementation - [pending]
9. Present results to user - [pending]
```

**Note on Step 5**: Mark as "completed" if skill was invoked, or "skipped" if strategy doesn't target BTC/ETH/SOL short-term markets.

---

### Step 5.5: Invoke Crypto Markets Skill (CONDITIONAL)

**CHECK**: Does the strategy target BTC/ETH/SOL 15-minute or 1-hour markets?

If YES, invoke the crypto-short-term-markets skill BEFORE the research agent:

```
Use Skill tool:
skill: "crypto-short-term-markets"
```

This will:
- Research current market slugs and IDs
- Gather volume, liquidity, spread data
- Document API patterns specific to these markets
- Write findings to `thoughts/shared/crypto-markets-research.md`

The research agent (Step 6) will then incorporate this market intelligence.

---

### Step 6: Spawn Research Agent

Tell the researcher to READ the strategy spec from thoughts:

```
Task with subagent_type="polymarket-researcher":

## Research Request

Research how to implement a Polymarket trading bot based on the strategy specification.

## Strategy Specification Location
**READ THIS FILE FIRST**: `thoughts/shared/polymarket-bot-specs/{filename}.md`

This file contains the complete, user-confirmed strategy specification including:
- Entry/exit logic
- Position sizing
- Market selection criteria
- Risk management rules
- Edge case handling

## Crypto Markets Research (IF AVAILABLE)
**IF targeting BTC/ETH/SOL short-term markets, ALSO READ**: `thoughts/shared/crypto-markets-research.md`

This file contains:
- Current market slugs and IDs
- Volume and liquidity metrics
- API patterns for 15-minute/hourly markets
- Trading characteristics and fee structures

## Your Task

Based on the strategy spec (and crypto markets research if applicable), research:

1. **API Endpoints**: Which Polymarket CLOB/Gamma/Data API endpoints are needed for this specific strategy?

2. **SDK Methods**: Which py-clob-client methods implement the required functionality?

3. **Authentication**: What auth level (L0/L1/L2) is required?

4. **Implementation Patterns**: How have similar strategies been implemented? Find code examples.

5. **Risk Factors**: What are the specific risks for THIS strategy and how to mitigate?

6. **Rate Limits**: Which rate limits are relevant for this strategy's access patterns?

7. **Code Examples**: Relevant snippets from py-clob-client examples.

8. **Market-Specific Considerations** (if crypto short-term):
   - Slug pattern generation for target timeframe
   - Fee impact on strategy profitability
   - Speed requirements for rapid-resolution markets

## Output

Write your research findings to: `thoughts/shared/polymarket-bot-specs/{filename}-research.md`

Return a summary of key findings.
```

**Wait for research to complete.**

---

### Step 7: Spawn Scaffolder Agent

Tell the scaffolder to READ both the spec and research:

```
Task with subagent_type="polymarket-bot-scaffolder":

## Scaffolding Request

Create a complete Polymarket trading bot in Python.

## Input Files (READ THESE FIRST)
1. **Strategy Spec**: `thoughts/shared/polymarket-bot-specs/{filename}.md`
2. **Research**: `thoughts/shared/polymarket-bot-specs/{filename}-research.md`

## Output Directory
`polymarket-bots/{strategy-slug}/`

## Requirements

1. Read the strategy spec file completely
2. Read the research file completely
3. Create a bot that EXACTLY implements the specified strategy
4. Include all configuration variables from the spec
5. Handle all edge cases listed in the spec
6. Use the SDK methods identified in research

## Output

Return a file manifest of all created files.
```

**Wait for scaffolding to complete.**

---

### Step 8: Spawn Auditor Agent

Tell the auditor to READ the spec and verify against it:

```
Task with subagent_type="polymarket-bot-auditor":

## Audit Request

Comprehensively audit the Polymarket bot against its specification.

## Input Files
1. **Strategy Spec**: `thoughts/shared/polymarket-bot-specs/{filename}.md`
2. **Bot Location**: `polymarket-bots/{strategy-slug}/`

## Audit Requirements

1. **Specification Compliance**: Does the bot implement what the spec says?
   - Check entry logic matches spec
   - Check exit logic matches spec
   - Check position sizing matches spec
   - Check risk management matches spec

2. **Technical Verification**: Standard audit categories
   - Syntax verification
   - Import verification
   - Config verification
   - Rate limiter verification
   - Error handler verification
   - Strategy logic verification

3. **Edge Case Coverage**: Test all edge cases from spec
   - Create test for each edge case listed
   - Verify handling matches spec

## Output

Generate comprehensive audit report including:
- Spec compliance check results
- Technical verification results
- Edge case test results
- Overall verdict
```

**Wait for audit to complete.**

---

### Step 9: Present Results

Present complete summary including:
- Strategy recap (what was built)
- Files created
- Audit results
- Setup instructions
- Risk warnings specific to this strategy

---

## Interrogation Examples

### Example 1: Vague Custom Strategy

**User**: `/create_single_strategy_bot I want to buy dips`

**You**:
```
I need to understand your "buy the dip" strategy better.

**Entry Signal:**
- What defines a "dip"? (e.g., 5% drop, 10% drop, hits specific price)
- Over what timeframe? (5 minutes, 1 hour, 24 hours)
- From what reference? (Recent high, opening price, moving average)

**Exit Signal:**
- When do you sell? (Fixed profit target, trailing stop, time-based)
- What's your stop loss?

**Position Sizing:**
- How much per trade?
- Do you scale in (buy more as it drops further)?

**Markets:**
- Specific markets or any market that dips?
- Any filters (liquidity, category)?
```

### Example 2: Complex Custom Strategy

**User**: `/create_single_strategy_bot momentum following with mean reversion exit`

**You**:
```
This sounds like a hybrid strategy. Let me understand each component:

**Momentum Entry:**
- What signal indicates momentum? (Price increase %, volume spike, etc.)
- Over what lookback period?
- Any confirmation required?

**Mean Reversion Exit:**
- What indicates mean reversion? (RSI, Bollinger bands, price deviation)
- At what level do you exit?
- Is this instead of or in addition to stop loss?

**Conflict Resolution:**
- What if momentum signal says enter but mean reversion says don't?
- What if you're in a position and both signals conflict?

Let's nail down these details.
```

### Example 3: Preset Strategy (No Interrogation Needed)

**User**: `/create_single_strategy_bot market_maker`

**You**:
```
Creating a market maker bot for Polymarket.

This is a preset strategy, so I already understand:
- Entry: Place bid below and ask above current midpoint
- Exit: Orders fill or get cancelled on next update
- Position: Spread width and order size are configurable
- Risk: Inventory accumulation during trends

Proceeding to research and implementation...
```

---

## Critical Rules

1. **NEVER proceed with ambiguity** for custom strategies
2. **ALWAYS confirm understanding** before writing spec
3. **ALWAYS use thoughts files** for agent handoff
4. **Sequential execution**: Research → Scaffold → Audit
5. **Safety warnings** for all strategies
6. **No credentials** in generated code

## Thoughts Directory Structure

```
thoughts/shared/polymarket-bot-specs/
├── 2026-01-06T12-00-00-market-maker.md           # Preset spec
├── 2026-01-06T12-00-00-market-maker-research.md  # Research output
├── 2026-01-06T14-30-00-buy-the-dip.md            # Custom spec
├── 2026-01-06T14-30-00-buy-the-dip-research.md   # Research output
└── ...
```
