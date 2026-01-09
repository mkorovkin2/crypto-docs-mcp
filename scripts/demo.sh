#!/bin/bash

# Demo script for Crypto Docs MCP Server
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
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}    Crypto Docs MCP Server - Interactive Demo${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "Target: ${YELLOW}$BASE_URL${NC}"
echo -e "Project: ${YELLOW}$PROJECT${NC}"
echo ""

# Check if server is running
echo -e "${YELLOW}[1/7] Checking server health...${NC}"
HEALTH=$(curl -s "$BASE_URL/health" 2>/dev/null)
if [ -z "$HEALTH" ]; then
    echo -e "${RED}Error: Server not responding at $BASE_URL${NC}"
    echo "Make sure to start it first: npm run server"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
echo ""

# Initialize connection
echo -e "${YELLOW}[2/7] Initializing MCP connection...${NC}"
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "demo-script", "version": "1.0.0"}
    },
    "id": 1
  }' | python3 -m json.tool 2>/dev/null
echo ""

# List available projects
echo -e "${YELLOW}[3/7] Listing available projects...${NC}"
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "list_projects", "arguments": {}}, "id": 2}' \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
content = data.get('result', {}).get('content', [{}])[0].get('text', '')
print(content[:500])
" 2>/dev/null
echo ""

# List available tools
echo -e "${YELLOW}[4/7] Listing available tools...${NC}"
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 3}' \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
tools = data.get('result', {}).get('tools', [])
for t in tools:
    print(f\"  • {t['name']}: {t['description'][:60]}...\")
" 2>/dev/null
echo ""

# Demo: search_documentation
echo -e "${YELLOW}[5/7] Demo: search_documentation${NC}"
echo -e "Query: ${GREEN}\"how to create a smart contract\"${NC} (project: $PROJECT)"
echo ""
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"search_documentation\",
      \"arguments\": {
        \"query\": \"how to create a smart contract\",
        \"project\": \"$PROJECT\",
        \"limit\": 2
      }
    },
    \"id\": 4
  }" | python3 -c "
import sys, json
data = json.load(sys.stdin)
content = data.get('result', {}).get('content', [{}])[0].get('text', '')
# Show first 1000 chars
print(content[:1000])
if len(content) > 1000:
    print('...[truncated]')
" 2>/dev/null
echo ""

# Demo: explain_concept
echo -e "${YELLOW}[6/7] Demo: explain_concept${NC}"
echo -e "Concept: ${GREEN}\"state management\"${NC} (project: $PROJECT)"
echo ""
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"explain_concept\",
      \"arguments\": {
        \"concept\": \"state management\",
        \"project\": \"$PROJECT\",
        \"depth\": \"brief\"
      }
    },
    \"id\": 5
  }" | python3 -c "
import sys, json
data = json.load(sys.stdin)
content = data.get('result', {}).get('content', [{}])[0].get('text', '')
print(content[:800])
if len(content) > 800:
    print('...[truncated]')
" 2>/dev/null
echo ""

# Demo: get_code_examples
echo -e "${YELLOW}[7/7] Demo: get_code_examples${NC}"
echo -e "Topic: ${GREEN}\"deploy\"${NC} (project: $PROJECT)"
echo ""
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"get_code_examples\",
      \"arguments\": {
        \"topic\": \"deploy\",
        \"project\": \"$PROJECT\",
        \"limit\": 2
      }
    },
    \"id\": 6
  }" | python3 -c "
import sys, json
data = json.load(sys.stdin)
content = data.get('result', {}).get('content', [{}])[0].get('text', '')
print(content[:1200])
if len(content) > 1200:
    print('...[truncated]')
" 2>/dev/null
echo ""

echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}Demo complete!${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo "Try your own queries:"
echo ""
echo "  # List projects"
echo "  curl -X POST $BASE_URL/mcp \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"list_projects\",\"arguments\":{}},\"id\":1}'"
echo ""
echo "  # Search documentation (with project)"
echo "  curl -X POST $BASE_URL/mcp \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"search_documentation\",\"arguments\":{\"query\":\"YOUR QUERY\",\"project\":\"mina\"}},\"id\":1}'"
echo ""
echo "  # Get code examples (with project)"
echo "  curl -X POST $BASE_URL/mcp \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"get_code_examples\",\"arguments\":{\"topic\":\"SmartContract\",\"project\":\"mina\"}},\"id\":1}'"
echo ""
echo "Run with different project: ./scripts/demo.sh solana"
echo ""
