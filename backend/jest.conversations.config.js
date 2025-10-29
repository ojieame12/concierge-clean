/**
 * Jest configuration for conversation quality tests
 * 
 * These tests validate natural conversation flow, warmth, and quality.
 * They use LLM-as-Judge scoring and may take longer than unit tests.
 */

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/conversations'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 60000, // 60s for API calls
  verbose: true,
  collectCoverage: false, // Don't need coverage for conversation tests
  maxWorkers: 1, // Run tests sequentially to avoid Gemini rate limits
};
