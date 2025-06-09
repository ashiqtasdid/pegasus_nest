#!/usr/bin/env node
/**
 * Test script for Incremental Agent Mode
 * Tests the enhanced agent mode for file-by-file creation
 */

const axios = require('axios').default || require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'test-user-' + Date.now();

async function testIncrementalMode() {
  console.log('🧪 Testing Enhanced Incremental Agent Mode');
  console.log('=' * 50);

  try {
    // Test 1: Health check
    console.log('\n1. 🏥 Testing Health Check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Status:', healthResponse.data.status);

    // Test 2: Agent health check
    console.log('\n2. 🤖 Testing Agent Health...');
    const agentHealthResponse = await axios.get(`${BASE_URL}/health/agents`);
    console.log('✅ Agent Status:', agentHealthResponse.data);

    // Test 3: Create a simple plugin using incremental mode
    console.log('\n3. 🚀 Testing Incremental Plugin Creation...');

    const pluginRequest = {
      prompt: 'Create a simple hello world plugin that adds a /hello command',
      pluginName: 'HelloWorldPlugin',
      userId: TEST_USER_ID,
      useIncrementalMode: true, // This should trigger our new mode
    };

    console.log('📝 Request payload:', JSON.stringify(pluginRequest, null, 2));

    // Make the request
    console.log('🔄 Sending request to /create...');
    const startTime = Date.now();

    const createResponse = await axios.post(
      `${BASE_URL}/create`,
      pluginRequest,
      {
        timeout: 300000, // 5 minutes timeout
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`⏱️  Request completed in ${duration} seconds`);
    console.log('✅ Response received:', {
      status: createResponse.status,
      success: createResponse.data.success,
      mode: createResponse.data.mode,
      message: createResponse.data.message,
    });

    if (createResponse.data.success) {
      console.log('🎉 Incremental mode test PASSED!');
      console.log('📊 Additional details:', {
        jarPath: createResponse.data.jarPath,
        createdFiles: createResponse.data.createdFiles?.length || 'N/A',
        qualityScore: createResponse.data.qualityScore || 'N/A',
        compilationSuccess: createResponse.data.compilationSuccess,
      });
    } else {
      console.log('⚠️  Plugin creation failed, but API responded correctly');
      console.log('📝 Error details:', createResponse.data.error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);

    if (error.response) {
      console.error('📝 Response data:', error.response.data);
      console.error('📝 Response status:', error.response.status);
    }

    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Server is not running. Please start the server first.');
    }
  }
}

// Run the test
testIncrementalMode()
  .then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test crashed:', error);
    process.exit(1);
  });
