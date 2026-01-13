#!/bin/bash
# Re-index all projects with new ordering metadata for adjacent chunk retrieval
#
# Usage: ./scripts/reindex-all.sh
#
# This script clears existing index data and re-indexes all configured projects.
# Run this after updating the chunking logic to include ordering metadata.

set -e

echo "=== Re-indexing all projects with ordering metadata ==="
echo ""
echo "This will clear existing data and re-index all documents."
echo "Make sure Qdrant is running: docker-compose up -d"
echo ""

# Change to project root
cd "$(dirname "$0")/.."

# Get list of projects from the scraper's --list output
echo "Discovering projects..."
PROJECTS=$(npm run --silent -w packages/scraper scraper -- --list 2>/dev/null | grep "^  -" | cut -d: -f1 | sed 's/  - //' || true)

if [ -z "$PROJECTS" ]; then
  echo "No projects found. Make sure project configs exist in config/projects/"
  exit 1
fi

echo "Found projects:"
for PROJECT in $PROJECTS; do
  echo "  - $PROJECT"
done
echo ""

# Confirm before proceeding
read -p "Proceed with re-indexing? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""

# Re-index each project
for PROJECT in $PROJECTS; do
  echo "=== Re-indexing: $PROJECT ==="
  npm run -w packages/scraper scraper -- --project "$PROJECT" --reindex --use-registry
  echo ""
done

echo "=== Re-indexing complete ==="
echo ""
echo "All projects have been re-indexed with ordering metadata."
echo "Adjacent chunk retrieval is now enabled for search queries."
