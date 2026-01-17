#!/bin/bash
#
# Setup script for Repository Documentation Generator
# Creates a virtual environment with Python 3.11 and installs all dependencies
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "  Repository Documentation Generator Setup"
echo "=============================================="
echo ""

# Find Python 3.11
PYTHON_CMD=""
if command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
elif command -v python3 &> /dev/null; then
    PY_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    if [[ "$PY_VERSION" == "3.11" ]] || [[ "$PY_VERSION" == "3.12" ]] || [[ "$PY_VERSION" == "3.13" ]]; then
        PYTHON_CMD="python3"
    fi
fi

if [ -z "$PYTHON_CMD" ]; then
    echo "Error: Python 3.11+ not found."
    echo "Please install Python 3.11 or higher."
    echo ""
    echo "On macOS with Homebrew:"
    echo "  brew install python@3.11"
    echo ""
    echo "On Ubuntu/Debian:"
    echo "  sudo apt install python3.11 python3.11-venv"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "Using Python $PYTHON_VERSION ($PYTHON_CMD)"

# Create virtual environment
VENV_DIR="$SCRIPT_DIR/venv"

if [ -d "$VENV_DIR" ]; then
    echo ""
    echo "Virtual environment already exists at: $VENV_DIR"
    read -p "Do you want to recreate it? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing existing virtual environment..."
        rm -rf "$VENV_DIR"
    else
        echo "Using existing virtual environment."
    fi
fi

if [ ! -d "$VENV_DIR" ]; then
    echo ""
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv "$VENV_DIR"
    echo "Virtual environment created at: $VENV_DIR"
fi

# Activate virtual environment
echo ""
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo ""
echo "Upgrading pip..."
pip install --upgrade pip --quiet

# Install dependencies
echo ""
echo "Installing dependencies..."
pip install -r requirements.txt

# Verify installation
echo ""
echo "Verifying installation..."
python -c "from agents import Agent; print('  ✓ OpenAI Agents SDK installed')"
python -c "import litellm; print('  ✓ LiteLLM installed')"
python -c "from rich.console import Console; print('  ✓ Rich installed')"
python -c "from pydantic import BaseModel; print('  ✓ Pydantic installed')"
python -c "from config import MODELS; print('  ✓ Config loaded')"
python -c "from models import DiscoveryHandoff; print('  ✓ Models loaded')"
python -c "from tools import read_file; print('  ✓ Tools loaded')"

# Check for .env file
echo ""
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo "Found .env file"

    # Check for API keys (without revealing them)
    if grep -q "ANTHROPIC_API_KEY=." "$SCRIPT_DIR/.env"; then
        echo "  ✓ ANTHROPIC_API_KEY is set"
    else
        echo "  ! ANTHROPIC_API_KEY is not set"
    fi

    if grep -q "GOOGLE_API_KEY=." "$SCRIPT_DIR/.env"; then
        echo "  ✓ GOOGLE_API_KEY is set"
    else
        echo "  ! GOOGLE_API_KEY is not set"
    fi

    if grep -q "XAI_API_KEY=." "$SCRIPT_DIR/.env"; then
        echo "  ✓ XAI_API_KEY is set"
    else
        echo "  ! XAI_API_KEY is not set"
    fi
else
    echo "Warning: .env file not found"
    echo "Please create a .env file with your API keys:"
    echo "  ANTHROPIC_API_KEY=your-key"
    echo "  GOOGLE_API_KEY=your-key"
    echo "  XAI_API_KEY=your-key"
fi

echo ""
echo "=============================================="
echo "  Setup Complete!"
echo "=============================================="
echo ""
echo "To activate the virtual environment:"
echo "  source venv/bin/activate"
echo ""
echo "To run the documentation generator:"
echo "  python main.py /path/to/repository"
echo ""
echo "Or use the run script:"
echo "  ./run.sh /path/to/repository"
echo ""
echo "For help:"
echo "  python main.py --help"
echo ""
