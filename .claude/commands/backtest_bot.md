---
description: Creates minimally-invasive backtesting infrastructure for a Polymarket bot. Analyzes the bot, researches historical data needs, scaffolds mock implementations, optionally runs backtest, and audits the results. The original bot code remains completely unchanged.
argument-hint: "<bot-directory> [--run] [--token TOKEN_ID] [--start YYYY-MM-DD] [--end YYYY-MM-DD]"
allowed-tools: Read, Write, Glob, Grep, Task, TodoWrite, Bash, AskUserQuestion
model: opus
---

# Backtest Bot Command

Generate comprehensive backtesting infrastructure for a Polymarket trading bot created by `/create_single_strategy_bot`.

**This command creates EXTERNAL backtesting infrastructure that wraps your bot WITHOUT modifying any of its original code.**

## How to Use

```bash
# Generate backtesting infrastructure only
/backtest_bot polymarket-bots/whale-tracker-fomo-exit

# Generate and run backtest
/backtest_bot polymarket-bots/whale-tracker-fomo-exit --run --token TOKEN_ID --start 2024-01-01 --end 2024-12-31
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `bot-directory` | Yes | Path to the bot directory |
| `--run` | No | Execute backtest after generating infrastructure |
| `--token` | If --run | Token ID to backtest |
| `--start` | If --run | Backtest start date (default: 90 days ago) |
| `--end` | If --run | Backtest end date (default: today) |
| `--capital` | No | Initial capital in USD (default: 10000) |

---

## YOUR PROCESS

### Step 1: Parse Arguments and Validate Input

Parse the command arguments:
- Extract bot directory path
- Check for --run flag
- Extract --token, --start, --end, --capital if provided

Validate the bot directory:
1. Check directory exists
2. Check for expected files (config.py, strategy modules)
3. Verify it looks like a Polymarket bot (uses py_clob_client)

```python
# Validation checks
required_patterns = [
    "config.py",
    "*.py with ClobClient import",
]
```

If validation fails:
```
The directory {path} doesn't appear to be a valid Polymarket bot.

Missing or unexpected:
- {list issues}

Expected structure:
- config.py (configuration)
- Strategy files using ClobClient

Is this a bot created by /create_single_strategy_bot?
```

---

### Step 2: Create Progress Tracking

Use TodoWrite to create a progress list:

```
1. Validate bot structure - [in_progress]
2. Analyze bot for backtesting requirements - [pending]
3. Research historical data sources - [pending]
4. Scaffold mock implementations - [pending]
5. (If --run) Execute backtest - [pending]
6. Audit backtesting infrastructure - [pending]
7. Present results - [pending]
```

---

### Step 3: Spawn Bot Analyzer Agent

Tell the analyzer to examine the bot:

```
Task with subagent_type="backtest-bot-analyzer":

## Bot Analysis Request

Analyze this Polymarket bot to prepare for backtesting infrastructure generation.

## Bot Directory
`{bot_directory}`

## Your Task

1. Read ALL Python files in the directory
2. Document every ClobClient method used:
   - Method name
   - File and line number
   - Parameters passed
   - Return value fields accessed
3. Identify the core strategy logic (entry/exit conditions)
4. Find all time-dependent code (datetime, time.sleep, lookback windows)
5. Extract configuration parameters relevant to backtesting
6. Note any external API calls (Gamma API, Data API)

## Output

Create directory `{bot_directory}/backtest/` if it doesn't exist.
Write your analysis to: `{bot_directory}/backtest/analysis.md`

Return a summary of:
- Number of ClobClient methods used
- Key strategy characteristics
- Any concerns for backtesting
```

**Wait for analysis to complete.**

Update todo: Mark "Analyze bot" as completed.

---

### Step 4: Spawn Data Researcher Agent

Tell the researcher to determine data requirements:

```
Task with subagent_type="backtest-data-researcher":

## Data Research Request

Research historical data requirements for backtesting this bot.

## Input Files
- Bot analysis: `{bot_directory}/backtest/analysis.md`
- Original bot: `{bot_directory}/`

## Your Task

1. Read the analysis.md file completely
2. For each ClobClient method used, identify:
   - Which Polymarket API endpoint provides historical equivalent
   - Data granularity needed (based on strategy's lookback windows)
   - Any authentication requirements
3. Document the data fetching strategy:
   - API endpoints to use
   - Pagination approach
   - Rate limiting considerations
4. Note any data limitations (resolved markets, sparse data, etc.)

## Output

Write your research to: `{bot_directory}/backtest/data_spec.md`

Return a summary of:
- Data sources identified
- Recommended granularity
- Any data availability concerns
```

**Wait for research to complete.**

Update todo: Mark "Research historical data" as completed.

---

### Step 5: Spawn Mock Scaffolder Agent

Tell the scaffolder to create the infrastructure:

```
Task with subagent_type="backtest-mock-scaffolder":

## Scaffolding Request

Create backtesting infrastructure for this bot.

## Input Files
READ THESE FIRST:
1. Bot analysis: `{bot_directory}/backtest/analysis.md`
2. Data spec: `{bot_directory}/backtest/data_spec.md`
3. Original bot code: `{bot_directory}/`

## CRITICAL RULES

1. **DO NOT modify any original bot files**
2. All new code goes in `{bot_directory}/backtest/`
3. MockClobClient must implement EVERY method listed in analysis.md
4. Return types must EXACTLY match what the bot expects

## Required Files

Create all of these in `{bot_directory}/backtest/`:

| File | Purpose |
|------|---------|
| `__init__.py` | Package init |
| `mock_client.py` | MockClobClient implementation |
| `data_loader.py` | Historical data fetching with caching |
| `backtest_engine.py` | Main backtest orchestration |
| `metrics.py` | Performance metric calculations |
| `visualization.py` | Charts and report generation |
| `run_backtest.py` | CLI entry point |
| `requirements.txt` | Additional dependencies |

Also create directories:
- `{bot_directory}/backtest/data/` (for cached data)
- `{bot_directory}/backtest/results/` (for output)

## Output

Return a file manifest listing all created files.
```

**Wait for scaffolding to complete.**

Update todo: Mark "Scaffold mock implementations" as completed.

---

### Step 6: Execute Backtest (If --run flag)

**Only if --run was specified:**

If --token was not provided, ask the user:

```
Task with subagent_type (inline - use AskUserQuestion):

To run the backtest, I need a token ID. This is the Polymarket market token you want to test the strategy on.

You can find token IDs by:
1. Going to a market on polymarket.com
2. Checking the API response in browser dev tools
3. Or using: curl "https://gamma-api.polymarket.com/markets?search=your+market"

What token ID would you like to backtest?
```

Then spawn the executor:

```
Task with subagent_type="backtest-executor":

## Backtest Execution Request

Execute backtest for this bot.

## Parameters
- Bot directory: `{bot_directory}`
- Token ID: `{token_id}`
- Start date: `{start_date}` (or 90 days ago if not specified)
- End date: `{end_date}` (or today if not specified)
- Initial capital: `{capital}` (or 10000 if not specified)
- Slippage: 0.1%

## Your Task

1. Verify all backtest infrastructure is in place
2. Install dependencies if needed
3. Run the backtest: `python backtest/run_backtest.py --token {token} --start {start} --end {end}`
4. Capture all output
5. Collect results from backtest/results/

## Output

Return:
- Key performance metrics (Total Return, Sharpe, Max Drawdown, Win Rate)
- Any warnings or issues
- Paths to generated reports/charts
```

**Wait for execution to complete.**

Update todo: Mark "Execute backtest" as completed.

---

### Step 7: Spawn Auditor Agent

Tell the auditor to verify the infrastructure:

```
Task with subagent_type="backtest-auditor":

## Audit Request

Audit the backtesting infrastructure for correctness.

## Input
- Bot analysis: `{bot_directory}/backtest/analysis.md`
- Bot directory: `{bot_directory}`
- Backtest infrastructure: `{bot_directory}/backtest/`

## Audit Categories

1. **Interface Compliance**: Does MockClobClient implement all methods the bot uses?
2. **Return Type Compliance**: Do mock methods return data in the exact format expected?
3. **No Lookahead Bias**: Does the mock only return data available at current_time?
4. **Order Simulation**: Are buy/sell fills realistic with proper slippage?
5. **Metrics Calculation**: Are performance metrics calculated correctly?

## Your Task

1. Create verification scripts in `{bot_directory}/backtest/temp-verify/`
2. Execute each script and capture output
3. Report PASS/FAIL for each category
4. If all pass, clean up temp-verify/
5. If any fail, keep scripts for debugging

## Output

Return audit report with:
- Verdict (PASS/PARTIAL/FAIL)
- Results for each category
- Any issues found
- Recommendations
```

**Wait for audit to complete.**

Update todo: Mark "Audit infrastructure" as completed.

---

### Step 8: Present Results

Present a comprehensive summary to the user:

```markdown
## Backtesting Infrastructure Created

### Bot Analyzed
- **Directory**: {bot_directory}
- **Strategy Type**: {from analysis - e.g., "Whale Tracker with FOMO Exit"}
- **ClobClient Methods Used**: {count} methods

### Infrastructure Created

| File | Purpose | Status |
|------|---------|--------|
| mock_client.py | MockClobClient with {n} methods | Created |
| data_loader.py | Historical data fetching | Created |
| backtest_engine.py | Backtest orchestration | Created |
| metrics.py | Performance calculations | Created |
| visualization.py | Charts and reports | Created |
| run_backtest.py | CLI entry point | Created |

### Audit Results

| Category | Result |
|----------|--------|
| Interface Compliance | {PASS/FAIL} |
| Return Type Compliance | {PASS/FAIL} |
| No Lookahead Bias | {PASS/FAIL} |
| Order Simulation | {PASS/FAIL} |
| Metrics Calculation | {PASS/FAIL} |

**Overall Verdict**: {PASS/PARTIAL/FAIL}

{If --run was used:}

### Backtest Results

| Metric | Value |
|--------|-------|
| Period | {start} to {end} |
| Initial Capital | ${capital:,.2f} |
| Final Equity | ${final:,.2f} |
| **Total Return** | **{return}%** |
| Sharpe Ratio | {sharpe} |
| Max Drawdown | {drawdown}% |
| Win Rate | {win_rate}% |
| Total Trades | {trades} |

Charts generated:
- `backtest/results/equity_curve.png`
- `backtest/results/trade_analysis.png`

{End if --run}

### How to Run Backtests

```bash
cd {bot_directory}

# Install dependencies
pip install -r backtest/requirements.txt

# Run backtest
python backtest/run_backtest.py \
    --token YOUR_TOKEN_ID \
    --start 2024-01-01 \
    --end 2024-12-31 \
    --capital 10000

# Results will be in backtest/results/
```

### Important Notes

1. **The original bot code was NOT modified** - all infrastructure is in backtest/
2. **Historical data is cached** - subsequent runs will be faster
3. **Slippage is simulated** - default 0.1%, adjust with --slippage flag

### Risk Warnings

- Backtests are simulations and do NOT guarantee future performance
- Historical data may have survivorship bias
- Market conditions change over time
- Real trading has additional costs (gas fees, slippage variance)

### Next Steps

1. Review the mock_client.py to ensure it matches your bot's actual usage
2. Run backtests on different time periods
3. Test with different parameter values
4. Consider walk-forward analysis for more robust results
```

---

## Error Handling

### Bot Directory Not Found
```
Error: Directory '{path}' not found.

Please provide a valid path to a Polymarket bot directory.
Example: /backtest_bot polymarket-bots/whale-tracker-fomo-exit
```

### Not a Valid Bot
```
Error: '{path}' doesn't appear to be a Polymarket trading bot.

Expected files:
- config.py (found: {yes/no})
- Python files importing ClobClient (found: {yes/no})

This command is designed for bots created by /create_single_strategy_bot.
```

### Agent Failure
If any agent fails:
1. Report which step failed
2. Include error details
3. Suggest remediation

### Data Fetch Failure
```
Warning: Could not fetch historical data for token {token_id}.

Possible causes:
- Invalid token ID
- Market may be resolved/archived
- API rate limiting

Try:
1. Verify the token ID is correct
2. Use a different date range
3. Wait and retry
```

---

## Critical Rules

1. **NEVER modify original bot code** - All changes in backtest/ directory only
2. **Sequential agent execution** - Each agent depends on previous output
3. **Wait for each agent** - Don't proceed until previous completes
4. **Verify interface compliance** - Mock must match real ClobClient exactly
5. **Include safety warnings** - Users must understand backtest limitations
6. **Report all issues** - Even "successful" runs may have warnings

## Agent Dependencies

```
Step 3: Analyzer
    ↓ writes analysis.md
Step 4: Data Researcher (reads analysis.md)
    ↓ writes data_spec.md
Step 5: Scaffolder (reads analysis.md + data_spec.md)
    ↓ creates backtest infrastructure
Step 6: Executor (optional, uses infrastructure)
    ↓ generates results
Step 7: Auditor (verifies infrastructure)
    ↓ creates audit report
Step 8: Present Results (summarizes everything)
```

Each step MUST complete before the next begins.
