#!/bin/bash

# PhotonFreak Backend Startup Script
# Run from photonfreak-fullstack directory: ./start-backend.sh

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
VENV_DIR="$PROJECT_DIR/.venv"

echo "🚀 PhotonFreak Backend Startup Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if venv exists
if [ ! -d "$VENV_DIR" ]; then
    echo "❌ Virtual environment not found at $VENV_DIR"
    echo ""
    echo "First time setup required. Run:"
    echo "  python3.13 -m venv .venv"
    echo "  source .venv/bin/activate"
    echo "  pip install -r backend/requirements.txt"
    echo "  pip install tensorflow scikit-learn"
    exit 1
fi

# Activate venv
echo "📦 Activating Python 3.13 virtual environment..."
source "$VENV_DIR/bin/activate"

# Check Python version
PYTHON_VERSION=$("$VENV_DIR/bin/python" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
if [[ "$PYTHON_VERSION" != "3.13" ]]; then
    echo "⚠️  Warning: Expected Python 3.13, but got $PYTHON_VERSION"
fi

# Navigate to backend
cd "$BACKEND_DIR"

# Start server with macOS compatibility settings
echo "🔧 Starting API Server with macOS compatibility settings..."
echo "   - DYLD_LIBRARY_PATH: /opt/homebrew/opt/libomp/lib"
echo "   - OMP_NUM_THREADS: 1"
echo "   - KMP_DUPLICATE_LIB_OK: TRUE"
echo ""
echo "📍 Server will be available at: http://localhost:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start server
export DYLD_LIBRARY_PATH=/opt/homebrew/opt/libomp/lib:$DYLD_LIBRARY_PATH
export OMP_NUM_THREADS=1
export KMP_DUPLICATE_LIB_OK=TRUE

"$VENV_DIR/bin/uvicorn" app.main:app --port 8000 --reload
