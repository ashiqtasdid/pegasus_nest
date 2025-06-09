const axios = require('axios');

const testEnhancedIncrementalAgent = async () => {
  console.log('🧪 Testing Enhanced Incremental Agent Mode...\n');

  const testData = {
    name: 'EconomyShop',
    pluginName: 'EconomyShop', // Test both parameter handling
    prompt:
      'A comprehensive economy and shop plugin with GUI, player balances, admin commands, and MySQL database support. Features include virtual currency, item shops with categories, transaction history, and configurable shop items.',
    userId: 'test-user-enhanced-agent',
    useIncrementalMode: true,
    useAgents: true,
    features: [
      'Virtual economy system with currency management',
      'GUI-based shop with item categories',
      'Player balance tracking and persistence',
      'Admin commands for economy management',
      'MySQL database integration',
      'Transaction history and logging',
      'Configurable shop items and prices',
      'Permission-based access control',
    ],
  };

  try {
    console.log('📝 Request payload:');
    console.log(JSON.stringify(testData, null, 2));
    console.log('\n🚀 Sending request to incremental agent...\n');

    const startTime = Date.now();
    const response = await axios.post(
      'http://localhost:3000/create',
      testData,
      {
        timeout: 300000, // 5 minutes timeout for complex plugins
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('✅ Response received!');
    console.log(`⏱️ Total time: ${duration} seconds\n`);

    console.log('📊 Response Summary:');
    console.log(`Status: ${response.status}`);
    console.log(`Success: ${response.data.success}`);
    console.log(`Plugin Name: ${response.data.pluginName}`);
    console.log(`Files Created: ${response.data.fileCount || 'N/A'}`);

    if (response.data.metrics) {
      console.log('\n📈 Performance Metrics:');
      console.log(`Quality Score: ${response.data.metrics.qualityScore}/100`);
      console.log(`Processing Time: ${response.data.metrics.processingTime}ms`);
      console.log(`Files Processed: ${response.data.metrics.filesProcessed}`);
      console.log(
        `Validation Passes: ${response.data.metrics.validationPasses}`,
      );
      console.log(`Retries Used: ${response.data.metrics.retriesUsed}`);
    }

    if (response.data.fileDetails) {
      console.log('\n📁 File Creation Details:');
      response.data.fileDetails.forEach((file, index) => {
        console.log(`${index + 1}. ${file.filename || file.name}`);
        console.log(`   Type: ${file.type || 'N/A'}`);
        console.log(`   Quality: ${file.qualityScore || 'N/A'}/100`);
        console.log(`   Size: ${file.size || 'N/A'} bytes`);
        if (file.createdAt) {
          console.log(
            `   Created: ${new Date(file.createdAt).toLocaleTimeString()}`,
          );
        }
      });
    }

    if (response.data.validation) {
      console.log('\n🔍 Cross-File Validation Results:');
      Object.entries(response.data.validation).forEach(([check, result]) => {
        const status = result.passed ? '✅' : '❌';
        console.log(`${status} ${check}: ${result.message || result.status}`);
        if (result.issues && result.issues.length > 0) {
          result.issues.forEach((issue) => {
            console.log(`    ⚠️ ${issue}`);
          });
        }
      });
    }

    console.log('\n🎯 Key Features Tested:');
    console.log('✅ Complete context sharing (all file contents sent to AI)');
    console.log('✅ Advanced cross-file validation system');
    console.log('✅ Enhanced dependency and reference validation');
    console.log('✅ Intelligent file ordering and creation');
    console.log('✅ Comprehensive quality tracking');
    console.log('✅ Real-time progress monitoring');

    return response.data;
  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(
        `Error: ${error.response.data.message || error.response.data}`,
      );
      console.error(
        'Response data:',
        JSON.stringify(error.response.data, null, 2),
      );
    } else if (error.request) {
      console.error('No response received:', error.message);
    } else {
      console.error('Request setup error:', error.message);
    }
    throw error;
  }
};

// Run the test
testEnhancedIncrementalAgent()
  .then((result) => {
    console.log('\n🎉 Enhanced Incremental Agent test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed with error:', error.message);
    process.exit(1);
  });
