/**
 * Test Runner
 * 
 * Runs all tests and generates a report
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
}

const runTests = async () => {
  console.log('🧪 Running Insite B2B Test Suite\n');

  const testFiles = [
    'golden/scenario-1-beginner-snowboard.test.ts',
    'golden/scenario-2-price-comparison.test.ts',
    'golden/scenario-3-store-intelligence.test.ts',
  ];

  const results: TestSuite[] = [];

  for (const testFile of testFiles) {
    const testPath = path.join(__dirname, testFile);
    const testName = path.basename(testFile, '.test.ts');

    console.log(`\n📝 Running: ${testName}`);
    console.log('─'.repeat(60));

    const startTime = Date.now();

    try {
      // Run Jest for this specific test file
      execSync(`npx jest ${testPath} --verbose`, {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
      });

      const duration = Date.now() - startTime;

      results.push({
        name: testName,
        tests: [],
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        duration,
      });

      console.log(`✅ ${testName} passed (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;

      results.push({
        name: testName,
        tests: [],
        totalTests: 0,
        passedTests: 0,
        failedTests: 1,
        duration,
      });

      console.log(`❌ ${testName} failed (${duration}ms)`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const totalSuites = results.length;
  const passedSuites = results.filter(r => r.failedTests === 0).length;
  const failedSuites = totalSuites - passedSuites;

  console.log(`\nTest Suites: ${passedSuites} passed, ${failedSuites} failed, ${totalSuites} total`);

  results.forEach(suite => {
    const status = suite.failedTests === 0 ? '✅' : '❌';
    console.log(`  ${status} ${suite.name} (${suite.duration}ms)`);
  });

  console.log('\n' + '='.repeat(60));

  if (failedSuites > 0) {
    console.log('\n❌ Some tests failed. See output above for details.\n');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  }
};

runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
