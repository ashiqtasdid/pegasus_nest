import { GeminiService } from './src/services/gemini.service';

// Test what TypeScript thinks the method signature is
const service = new GeminiService();

// This should show what parameters TypeScript expects
service.processDirectPrompt('test'); // Single param - should work if method takes 1 param
service.processDirectPrompt('test', 'model'); // Two params - should work if method takes 2 params

// Let's also check if the method exists at all
console.log(typeof service.processDirectPrompt);
