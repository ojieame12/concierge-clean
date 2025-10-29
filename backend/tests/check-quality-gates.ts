/**
 * Quality Gate Checker
 * 
 * Validates that conversation quality metrics meet minimum thresholds.
 * Used in CI/CD pipeline to prevent regressions.
 */

import * as fs from 'fs';
import * as path from 'path';

interface QualityMetrics {
  naturalness: number;
  recommendations: number;
  clarification: number;
  guidance: number;
  overall: number;
  passed: number;
  total: number;
  duration: number;
}

interface QualityGate {
  name: string;
  threshold: number;
  actual: number;
  passed: boolean;
}

const QUALITY_THRESHOLDS = {
  naturalness: 4.0,
  recommendations: 4.0,
  clarification: 4.0,
  guidance: 4.0,
  overall: 4.0,
  passRate: 0.9, // 90% of tests must pass
};

/**
 * Load test results from JSON file
 */
function loadTestResults(resultsPath: string): QualityMetrics | null {
  try {
    const data = fs.readFileSync(resultsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to load test results from ${resultsPath}:`, error);
    return null;
  }
}

/**
 * Check quality gates
 */
function checkQualityGates(metrics: QualityMetrics): QualityGate[] {
  const gates: QualityGate[] = [
    {
      name: 'Naturalness Score',
      threshold: QUALITY_THRESHOLDS.naturalness,
      actual: metrics.naturalness,
      passed: metrics.naturalness >= QUALITY_THRESHOLDS.naturalness,
    },
    {
      name: 'Recommendations Score',
      threshold: QUALITY_THRESHOLDS.recommendations,
      actual: metrics.recommendations,
      passed: metrics.recommendations >= QUALITY_THRESHOLDS.recommendations,
    },
    {
      name: 'Clarification Score',
      threshold: QUALITY_THRESHOLDS.clarification,
      actual: metrics.clarification,
      passed: metrics.clarification >= QUALITY_THRESHOLDS.clarification,
    },
    {
      name: 'Guidance Score',
      threshold: QUALITY_THRESHOLDS.guidance,
      actual: metrics.guidance,
      passed: metrics.guidance >= QUALITY_THRESHOLDS.guidance,
    },
    {
      name: 'Overall Score',
      threshold: QUALITY_THRESHOLDS.overall,
      actual: metrics.overall,
      passed: metrics.overall >= QUALITY_THRESHOLDS.overall,
    },
    {
      name: 'Test Pass Rate',
      threshold: QUALITY_THRESHOLDS.passRate,
      actual: metrics.passed / metrics.total,
      passed: metrics.passed / metrics.total >= QUALITY_THRESHOLDS.passRate,
    },
  ];

  return gates;
}

/**
 * Print quality gate results
 */
function printResults(gates: QualityGate[], metrics: QualityMetrics): void {
  console.log('\n🚦 Quality Gate Results\n');
  console.log('═'.repeat(80));

  for (const gate of gates) {
    const status = gate.passed ? '✅' : '❌';
    const actualStr = gate.name.includes('Rate')
      ? `${(gate.actual * 100).toFixed(1)}%`
      : gate.actual.toFixed(2);
    const thresholdStr = gate.name.includes('Rate')
      ? `${(gate.threshold * 100).toFixed(1)}%`
      : gate.threshold.toFixed(2);

    console.log(`${status} ${gate.name.padEnd(30)} ${actualStr.padStart(8)} / ${thresholdStr}`);
  }

  console.log('═'.repeat(80));
  console.log(`\n📊 Test Summary: ${metrics.passed}/${metrics.total} passed (${metrics.duration.toFixed(1)}s)`);

  const allPassed = gates.every((g) => g.passed);
  if (allPassed) {
    console.log('\n✅ All quality gates passed!\n');
  } else {
    console.log('\n❌ Some quality gates failed. Please review and improve conversation quality.\n');
  }
}

/**
 * Main function
 */
function main() {
  const resultsPath = process.argv[2] || path.join(__dirname, '../test-results/summary.json');

  console.log(`Loading test results from: ${resultsPath}`);

  const metrics = loadTestResults(resultsPath);
  if (!metrics) {
    console.error('❌ Failed to load test results');
    process.exit(1);
  }

  const gates = checkQualityGates(metrics);
  printResults(gates, metrics);

  const allPassed = gates.every((g) => g.passed);
  process.exit(allPassed ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main();
}

export { checkQualityGates, loadTestResults, QUALITY_THRESHOLDS };
