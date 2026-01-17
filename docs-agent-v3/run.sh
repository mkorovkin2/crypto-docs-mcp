#!/bin/bash
#
# Run script for Repository Documentation Generator
# Activates the virtual environment and runs the main script
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if virtual environment exists
if [ ! -d "$SCRIPT_DIR/venv" ]; then
    echo "Virtual environment not found. Running setup first..."
    ./setup.sh
fi

# Activate virtual environment
source "$SCRIPT_DIR/venv/bin/activate"

# Run the main script with all passed arguments
python main.py "$@"
