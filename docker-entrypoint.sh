#!/bin/bash
set -e

echo "=========================================="
echo "🚀 Starting Valorie Framework Builder"
echo "=========================================="

# Display environment configuration
echo "📋 Environment Configuration:"
echo "  - LLM_TYPE: ${LLM_TYPE:-not set}"
echo "  - LOCAL_LLM_URL: ${LOCAL_LLM_URL:-not set}"
echo "  - PORT: ${PORT:-8000}"

# Test Cloud LLM connection (optional)
if [ -n "$LOCAL_LLM_URL" ]; then
    echo "🔍 Testing Cloud LLM connection..."
    if curl -s --connect-timeout 5 "${LOCAL_LLM_URL%/v1}/health" > /dev/null 2>&1 || \
       curl -s --connect-timeout 5 "${LOCAL_LLM_URL}" > /dev/null 2>&1; then
        echo "✅ Cloud LLM is accessible"
    else
        echo "⚠️  Warning: Cloud LLM may not be accessible"
        echo "   This is OK if you're only using ChatGPT API"
    fi
fi

# Check if frontend static files exist
if [ -d "/app/static/frontend" ]; then
    FILE_COUNT=$(find /app/static/frontend -type f | wc -l)
    echo "✅ Frontend static files found ($FILE_COUNT files)"
else
    echo "⚠️  Warning: Frontend static files not found at /app/static/frontend"
fi

echo "=========================================="
echo "🌐 Starting FastAPI server on port ${PORT:-8000}"
echo "=========================================="

# Start uvicorn server
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WORKERS:-1}" \
    --log-level info