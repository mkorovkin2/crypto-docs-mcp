#!/bin/bash

# Demo script for Crypto Docs MCP Server v2.0
# Usage: ./scripts/demo.sh [project]
#
# Make sure the server is running first: npm run server

BASE_URL="${MCP_URL:-http://localhost:3000}"
PROJECT="${1:-mina}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}    Crypto Docs MCP Server v2.0 - Quick Demo${NC}"
echo -e "${BLUE}    (LLM-Synthesized Responses)${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Target: ${YELLOW}$BASE_URL${NC}"
echo -e "Project: ${YELLOW}$PROJECT${NC}"
echo ""

# Check if server is running
echo -e "${YELLOW}[1/5] Checking server health...${NC}"
HEALTH=$(curl -s "$BASE_URL/health" 2>/dev/null)
if [ -z "$HEALTH" ]; then
    echo -e "${RED}Error: Server not responding at $BASE_URL${NC}"
    echo "Make sure to start it first: npm run server"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
echo ""

# List available tools
echo -e "${YELLOW}[2/5] Listing available tools...${NC}"
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}' \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
tools = data.get('result', {}).get('tools', [])
for t in tools:
    print(f\"  • {t['name']}: {t['description'][:50]}...\")
" 2>/dev/null
echo ""

# Demo: ask_docs (LLM synthesized!)
echo -e "${YELLOW}[3/5] Demo: ask_docs (LLM-synthesized answer)${NC}"
echo -e "Question: ${GREEN}\"What is a smart contract in $PROJECT?\"${NC}"
echo -e "${DIM}(This synthesizes an answer from docs using LLM!)${NC}"
echo ""
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"ask_docs\",
      \"arguments\": {
        \"question\": \"What is a smart contract in $PROJECT? Explain briefly.\",
        \"project\": \"$PROJECT\",
        \"maxTokens\": 800
      }
    },
    \"id\": 2
  }" | python3 -c "
import sys, json
data = json.load(sys.stdin)
content = data.get('result', {}).get('content', [{}])[0].get('text', '')
print(content[:1500])
if len(content) > 1500:
    print('...[truncated]')
" 2>/dev/null
echo ""

# Demo: get_working_example (LLM synthesized!)
echo -e "${YELLOW}[4/5] Demo: get_working_example (complete code)${NC}"
echo -e "Task: ${GREEN}\"create a basic counter\"${NC}"
echo -e "${DIM}(This creates a complete example with ALL imports!)${NC}"
echo ""
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"get_working_example\",
      \"arguments\": {
        \"task\": \"create a basic counter\",
        \"project\": \"$PROJECT\",
        \"maxTokens\": 1000
      }
    },
    \"id\": 3
  }" | python3 -c "
import sys, json
data = json.load(sys.stdin)
content = data.get('result', {}).get('content', [{}])[0].get('text', '')
print(content[:2000])
if len(content) > 2000:
    print('...[truncated]')
" 2>/dev/null
echo ""

# Demo: search_docs (raw search)
echo -e "${YELLOW}[5/5] Demo: search_docs (raw chunks)${NC}"
echo -e "Query: ${GREEN}\"deploy\"${NC}"
echo -e "${DIM}(This returns raw chunks for browsing)${NC}"
echo ""
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"search_docs\",
      \"arguments\": {
        \"query\": \"deploy\",
        \"project\": \"$PROJECT\",
        \"limit\": 2
      }
    },
    \"id\": 4
  }" | python3 -c "
import sys, json
data = json.load(sys.stdin)
content = data.get('result', {}).get('content', [{}])[0].get('text', '')
print(content[:1200])
if len(content) > 1200:
    print('...[truncated]')
" 2>/dev/null
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Demo complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "New v2.0 tools:"
echo -e "  ${CYAN}ask_docs${NC}            - Ask questions, get synthesized answers"
echo -e "  ${CYAN}get_working_example${NC} - Get complete code with all imports"
echo -e "  ${CYAN}explain_error${NC}       - Debug errors with explanations"
echo -e "  ${CYAN}search_docs${NC}         - Raw search when needed"
echo ""
echo "Run with different project: ./scripts/demo.sh solana"
echo ""
