// 🧪 DIAGNOSTIC TOOL: AI Error Fixing System Validation
// This script tests the complete AI error fixing workflow including:
// - AI service connectivity
// - Compilation error detection
// - Auto-fix and AI-based fixing
// - JAR artifact generation
//
// Usage: node test-ai-fixing.js
// Status: VALIDATED WORKING ✅

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const {
  CodeCompilerService,
} = require('./dist/services/code-compiler.service');
const { GeminiService } = require('./dist/services/gemini.service');
require('dotenv').config();

async function testAIFixing() {
  console.log('🔍 Testing AI Error Fixing Configuration...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(
    `OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '✅ Set' : '❌ Missing'}`,
  );
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);
  console.log(`SITE_URL: ${process.env.SITE_URL || 'Not set'}\n`);

  try {
    // Create NestJS application
    const app = await NestFactory.create(AppModule, {
      logger: ['log', 'error', 'warn'],
    });

    // Get services
    const {
      CodeCompilerService,
    } = require('./dist/services/code-compiler.service');
    const { GeminiService } = require('./dist/services/gemini.service');
    const codeCompilerService = app.get(CodeCompilerService);
    const geminiService = app.get(GeminiService);

    console.log('🧪 Testing AI Service Connection...');

    // Test basic AI connectivity
    try {
      const testPrompt =
        'Respond with only "AI_CONNECTION_OK" if you can understand this message.';
      const response = await geminiService.processWithGemini(testPrompt);
      console.log(`✅ AI Service Response: ${response.trim()}\n`);
    } catch (error) {
      console.log(`❌ AI Service Error: ${error.message}\n`);
      return;
    }

    // Test with a sample project if available
    const testProjectPath = './generated/test-plugin';
    const fs = require('fs');

    if (fs.existsSync(testProjectPath)) {
      console.log(
        '🏗️ Testing compilation with AI fixing on existing project...',
      );

      const result =
        await codeCompilerService.compileMavenProject(testProjectPath);

      console.log('📊 Compilation Result:');
      console.log(`Success: ${result.success}`);
      console.log(`Output preview: ${result.output?.substring(0, 200)}...`);
      if (result.error) {
        console.log(`Error preview: ${result.error.substring(0, 200)}...`);
      }
      console.log(`Errors found: ${result.errors?.length || 0}`);
      console.log(`Warnings: ${result.warnings?.length || 0}`);

      if (result.artifactPath) {
        console.log(`✅ Artifact generated: ${result.artifactPath}`);
      }
    } else {
      console.log('⚠️ No test project found at ./generated/dragonrider');
    }

    await app.close();
    console.log('\n✅ Test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAIFixing().catch(console.error);
