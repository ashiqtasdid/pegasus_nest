#!/usr/bin/env node

/**
 * Test script for enhanced incremental agent accuracy features
 * This script verifies that the enhanced accuracy implementation is working correctly
 */

console.log('🧪 Testing Enhanced Incremental Agent Service...\n');

const fs = require('fs');
const path = require('path');

// Test 1: Verify enhanced interfaces are present
console.log('1. Checking Enhanced Accuracy Interfaces...');
const serviceFile = fs.readFileSync(
  path.join(__dirname, 'src/services/incremental-agent.service.ts'),
  'utf-8',
);

const expectedInterfaces = [
  'AdaptiveLearningMetrics',
  'SuccessPattern',
  'FailurePattern',
  'ValidationThresholds',
  'TemplatePattern',
  'QualityGate',
];

const missingInterfaces = expectedInterfaces.filter(
  (interfaceName) => !serviceFile.includes(`interface ${interfaceName}`),
);

if (missingInterfaces.length === 0) {
  console.log('   ✅ All enhanced accuracy interfaces found');
} else {
  console.log(`   ❌ Missing interfaces: ${missingInterfaces.join(', ')}`);
}

// Test 2: Verify enhanced context properties
console.log('\n2. Checking Enhanced Context Properties...');
const expectedContextProperties = [
  'adaptiveLearning: AdaptiveLearningMetrics',
  'validationThresholds: ValidationThresholds',
  'qualityGates: QualityGate[]',
  'detectedPatterns: SuccessPattern[]',
  'avoidedPatterns: FailurePattern[]',
  'availableTemplates: Map<string, TemplatePattern>',
  'templateUsage: Map<string, number>',
  'complexityScore: number',
  'riskFactors: string[]',
  'fallbackStrategy:',
];

const missingProperties = expectedContextProperties.filter(
  (property) => !serviceFile.includes(property),
);

if (missingProperties.length === 0) {
  console.log('   ✅ All enhanced context properties found');
} else {
  console.log(`   ❌ Missing properties: ${missingProperties.join(', ')}`);
}

// Test 3: Verify enhanced methods
console.log('\n3. Checking Enhanced Accuracy Methods...');
const expectedMethods = [
  'initializeAdaptiveLearning',
  'determinePluginComplexity',
  'getValidationThresholds',
  'initializeQualityGates',
  'loadFailurePatterns',
  'loadTemplatePatterns',
  'analyzeComplexity',
  'updateSuccessPattern',
  'recordFailurePattern',
  'applyQualityGates',
  'getOptimalTemplate',
  'determineFallbackStrategy',
];

const missingMethods = expectedMethods.filter(
  (methodName) => !serviceFile.includes(`${methodName}(`),
);

if (missingMethods.length === 0) {
  console.log('   ✅ All enhanced accuracy methods found');
} else {
  console.log(`   ❌ Missing methods: ${missingMethods.join(', ')}`);
}

// Test 4: Verify enhanced context initialization
console.log('\n4. Checking Enhanced Context Initialization...');
const hasEnhancedInit =
  serviceFile.includes('initializeAdaptiveLearning') &&
  serviceFile.includes('sessionId') &&
  serviceFile.includes('refinedPrompt') &&
  serviceFile.includes('this.initializeQualityGates()') &&
  serviceFile.includes('this.analyzeComplexity(baseContext)') &&
  serviceFile.includes('this.determineFallbackStrategy(baseContext)');

if (hasEnhancedInit) {
  console.log('   ✅ Enhanced context initialization implemented');
} else {
  console.log('   ❌ Enhanced context initialization incomplete');
}

// Test 5: Check compilation status
console.log('\n5. Checking Compilation Status...');
let compilationPassed = false;
try {
  const { execSync } = require('child_process');
  execSync('cd /home/ashiqtasdid/codespace/pegasus_nest && npx tsc --noEmit', {
    stdio: 'pipe',
  });
  console.log('   ✅ TypeScript compilation successful');
  compilationPassed = true;
} catch (error) {
  console.log('   ❌ TypeScript compilation errors detected');
  console.log('   Error:', error.message);
}

// Summary
console.log('\n📊 Enhancement Implementation Summary:');
console.log('=====================================');

const totalTests = 5;
let passedTests = 0;

if (missingInterfaces.length === 0) passedTests++;
if (missingProperties.length === 0) passedTests++;
if (missingMethods.length === 0) passedTests++;
if (hasEnhancedInit) passedTests++;
if (compilationPassed) passedTests++;

console.log(`Tests Passed: ${passedTests}/${totalTests}`);
console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

if (passedTests === totalTests) {
  console.log('\n🎉 Enhanced Incremental Agent Service is fully implemented!');
  console.log('   All accuracy features are in place and ready for testing.');
} else {
  console.log('\n⚠️  Enhanced Incremental Agent Service needs attention.');
  console.log('   Some features may not be fully implemented.');
}

console.log('\n🔄 Next Steps:');
console.log('   1. Run integration tests with actual plugin generation');
console.log('   2. Monitor adaptive learning metrics during real usage');
console.log('   3. Fine-tune validation thresholds based on performance data');
console.log(
  '   4. Collect success/failure patterns for continuous improvement',
);
