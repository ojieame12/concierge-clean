/**
 * JUDGE-DRIFT-01: Judge Drift Monitoring Test
 * 
 * Monitors LLM judge scores over time and fails CI on significant drift.
 * This test runs AFTER all other conversation tests to collect scores.
 * 
 * Quality Gates:
 * - Critical drift (≥1.0 points) fails CI
 * - Warning drift (≥0.5 points) logs warning
 * - Info drift (≥0.3 points) logs info
 * 
 * Note: This test should be the LAST test in the suite (use `z` prefix in filename if needed)
 */

import { getGlobalMonitor } from '../utils/judgeDriftMonitor';

describe('JUDGE-DRIFT-01: Monitor Judge Score Drift', () => {
  it('should save current judge scores snapshot', () => {
    const monitor = getGlobalMonitor();
    
    // Save snapshot
    monitor.save();
    
    console.log('\n✅ Judge scores snapshot saved');
  });

  it('should check for drift against previous snapshot', () => {
    const monitor = getGlobalMonitor();
    
    // Check drift
    const alerts = monitor.checkDrift();
    
    // Print report
    monitor.printDriftReport(alerts);
    
    // Log summary
    const critical = alerts.filter((a) => a.severity === 'critical').length;
    const warnings = alerts.filter((a) => a.severity === 'warning').length;
    const info = alerts.filter((a) => a.severity === 'info').length;
    
    console.log('\n📊 Drift Summary:');
    console.log(`  Critical: ${critical}`);
    console.log(`  Warnings: ${warnings}`);
    console.log(`  Info: ${info}`);
    
    // Fail on critical drift
    if (critical > 0) {
      monitor.failOnCriticalDrift(alerts);
    }
  });

  it('should provide recommendations if drift detected', () => {
    const monitor = getGlobalMonitor();
    const alerts = monitor.checkDrift();
    
    if (alerts.length === 0) {
      console.log('\n✅ No drift detected - all scores stable');
      return;
    }

    console.log('\n💡 Drift Detected - Recommendations:');
    console.log('');
    
    const critical = alerts.filter((a) => a.severity === 'critical');
    const warnings = alerts.filter((a) => a.severity === 'warning');
    
    if (critical.length > 0) {
      console.log('🚨 CRITICAL DRIFT:');
      console.log('  1. Check if Gemini model version changed');
      console.log('  2. Review system prompt for unintended changes');
      console.log('  3. Verify judge prompts are still accurate');
      console.log('  4. Consider re-baselining if intentional improvement');
      console.log('');
    }
    
    if (warnings.length > 0) {
      console.log('⚠️  WARNING DRIFT:');
      console.log('  1. Monitor for trend over next few runs');
      console.log('  2. Review affected scenarios for quality issues');
      console.log('  3. Consider tuning system prompt if consistent');
      console.log('');
    }
    
    console.log('📖 For more info, see: docs/JUDGE_DRIFT_MONITORING.md');
  });
});
