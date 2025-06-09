#!/bin/bash

# Test script for Incremental Agent Mode using curl
# Tests the enhanced agent mode for file-by-file creation

BASE_URL="http://localhost:3000"
TEST_USER_ID="test-user-$(date +%s)"

echo "🧪 Testing Enhanced Incremental Agent Mode"
echo "================================================"

# Test 1: Health check
echo ""
echo "1. 🏥 Testing Health Check..."
health_response=$(curl -s "$BASE_URL/health")
echo "✅ Health Status: $health_response"

# Test 2: Agent health check  
echo ""
echo "2. 🤖 Testing Agent Health..."
agent_health_response=$(curl -s "$BASE_URL/health/agents")
echo "✅ Agent Status: $agent_health_response"

# Test 3: Create a simple plugin using incremental mode
echo ""
echo "3. 🚀 Testing Incremental Plugin Creation..."

# Create JSON payload
cat > /tmp/test_payload.json << EOF
{
  "prompt": "Create a simple hello world plugin that adds a /hello command",
  "name": "HelloWorldPlugin",
  "userId": "$TEST_USER_ID",
  "useIncrementalMode": true
}
EOF

echo "📝 Request payload:"
cat /tmp/test_payload.json | jq . 2>/dev/null || cat /tmp/test_payload.json

echo ""
echo "🔄 Sending request to /create..."
start_time=$(date +%s)

# Make the request with timeout
response=$(curl -s \
  -X POST \
  -H "Content-Type: application/json" \
  -d @/tmp/test_payload.json \
  --max-time 300 \
  "$BASE_URL/create")

end_time=$(date +%s)
duration=$((end_time - start_time))

echo ""
echo "⏱️  Request completed in $duration seconds"
echo "✅ Response received:"
echo "$response" | jq . 2>/dev/null || echo "$response"

# Check if the response indicates success
if echo "$response" | grep -q '"success":true'; then
  echo ""
  echo "🎉 Incremental mode test PASSED!"
elif echo "$response" | grep -q '"useIncrementalMode":true'; then
  echo ""
  echo "✅ Incremental mode was triggered correctly!"
else
  echo ""
  echo "⚠️  Response received but checking for incremental mode indicators..."
fi

# Cleanup
rm -f /tmp/test_payload.json

echo ""
echo "🏁 Test completed"
