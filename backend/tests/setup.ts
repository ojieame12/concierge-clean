/**
 * Test Setup and Configuration
 * 
 * Sets up the testing environment for the Insite B2B backend.
 */

import 'dotenv/config';

// Mock environment variables for testing
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.SUPABASE_DB_URL = process.env.SUPABASE_DB_URL || 'postgresql://test:test@localhost:5432/test';
process.env.GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || 'test-google-api-key';
process.env.CLIENT_API_KEYS = process.env.CLIENT_API_KEYS || 'test-client-key';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:3300';

// Test timeout
jest.setTimeout(30000); // 30 seconds for LLM calls

export const testConfig = {
  skipLLMTests: process.env.SKIP_LLM_TESTS === 'true',
  skipDBTests: process.env.SKIP_DB_TESTS === 'true',
};
