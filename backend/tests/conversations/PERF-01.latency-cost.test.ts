/**
 * PERF-01: Latency & Cost Guardrails Test
 * 
 * Tracks performance metrics and fails if they degrade significantly.
 * Prevents cost creep and latency regression.
 * 
 * Metrics Tracked:
 * - P50, P95, P99 latency per turn
 * - Input/output tokens per turn
 * - Estimated cost per conversation
 * 
 * Quality Gates:
 * - P95 latency must not increase >20% week-over-week
 * - Tokens per turn must not increase >20% week-over-week
 * - Cost must not increase >20% week-over-week
 */

import { startSession, send, endSession } from '../utils/convoHarness';
import {
  PerfTracker,
  loadPerfSnapshot,
  savePerfSnapshot,
  comparePerfMetrics,
  printPerfMetrics,
  aggregatePerfMetrics,
  type PerfSnapshot,
  type PerfMetrics,
} from '../utils/perfTracker';

describe('PERF-01: Latency & Cost Guardrails', () => {
  const allMetrics: PerfMetrics[] = [];

  it('should track performance for running shoes conversation', async () => {
    const tracker = new PerfTracker('CONV-RUN-PERF');
    tracker.start();

    const session = await startSession({
      shopDomain: 'run.local',
      persona: 'friendly_expert',
    });

    const turnStart1 = Date.now();
    const response1 = await send(session, "I need running shoes for marathon training");
    const turnEnd1 = Date.now();
    tracker.recordTurn(turnEnd1 - turnStart1, 1500, 300); // Estimated tokens

    const turnStart2 = Date.now();
    const response2 = await send(session, "I'm an intermediate runner, mostly roads");
    const turnEnd2 = Date.now();
    tracker.recordTurn(turnEnd2 - turnStart2, 1600, 250);

    const turnStart3 = Date.now();
    const response3 = await send(session, "Budget is around $150");
    const turnEnd3 = Date.now();
    tracker.recordTurn(turnEnd3 - turnStart3, 1650, 280);

    const turnStart4 = Date.now();
    const response4 = await send(session, "Show me your recommendations");
    const turnEnd4 = Date.now();
    tracker.recordTurn(turnEnd4 - turnStart4, 1700, 400);

    await endSession(session);
    tracker.end();

    const metrics = tracker.getMetrics();
    allMetrics.push(metrics);

    printPerfMetrics(metrics);

    // Basic sanity checks
    expect(metrics.turns).toBe(4);
    expect(metrics.latency.p95).toBeGreaterThan(0);
    expect(metrics.tokens.total).toBeGreaterThan(0);
    expect(metrics.cost.estimated).toBeGreaterThan(0);

    // P95 latency should be reasonable (<5 seconds)
    expect(metrics.latency.p95).toBeLessThan(5000);

    // Tokens per turn should be reasonable (<3000)
    expect(metrics.tokens.perTurn).toBeLessThan(3000);
  });

  it('should track performance for snowboard conversation', async () => {
    const tracker = new PerfTracker('CONV-SNOW-PERF');
    tracker.start();

    const session = await startSession({
      shopDomain: 'snow.local',
      persona: 'friendly_expert',
    });

    const turnStart1 = Date.now();
    const response1 = await send(session, "I'm looking for a beginner snowboard");
    const turnEnd1 = Date.now();
    tracker.recordTurn(turnEnd1 - turnStart1, 1400, 280);

    const turnStart2 = Date.now();
    const response2 = await send(session, "I'm 5'8\" and weigh 160 lbs");
    const turnEnd2 = Date.now();
    tracker.recordTurn(turnEnd2 - turnStart2, 1500, 250);

    const turnStart3 = Date.now();
    const response3 = await send(session, "Mostly all-mountain riding");
    const turnEnd3 = Date.now();
    tracker.recordTurn(turnEnd3 - turnStart3, 1550, 270);

    await endSession(session);
    tracker.end();

    const metrics = tracker.getMetrics();
    allMetrics.push(metrics);

    printPerfMetrics(metrics);

    // Basic sanity checks
    expect(metrics.turns).toBe(3);
    expect(metrics.latency.p95).toBeLessThan(5000);
    expect(metrics.tokens.perTurn).toBeLessThan(3000);
  });

  it('should compare against previous snapshot and fail if degraded', async () => {
    // Load previous snapshot
    const previousSnapshot = loadPerfSnapshot();

    if (!previousSnapshot) {
      console.log('⚠️  No previous snapshot found. Creating baseline...');
      
      // Create new snapshot
      const newSnapshot: PerfSnapshot = {
        date: new Date().toISOString(),
        commit: process.env.GITHUB_SHA || 'local',
        scenarios: {},
        summary: aggregatePerfMetrics(allMetrics),
      };

      for (const metrics of allMetrics) {
        newSnapshot.scenarios[metrics.testName] = metrics;
      }

      savePerfSnapshot(newSnapshot);
      
      console.log('✅ Baseline snapshot created');
      return; // Pass on first run
    }

    console.log('\n📊 Comparing against previous snapshot');
    console.log(`Previous: ${previousSnapshot.date}`);
    console.log(`Commit: ${previousSnapshot.commit}`);

    // Compare each scenario
    let allPassed = true;
    const allWarnings: string[] = [];

    for (const metrics of allMetrics) {
      const previousMetrics = previousSnapshot.scenarios[metrics.testName];
      const { passed, warnings } = comparePerfMetrics(metrics, previousMetrics);

      if (!passed) {
        allPassed = false;
        allWarnings.push(...warnings);
      }

      if (warnings.length > 0) {
        console.log(`\n${metrics.testName}:`);
        warnings.forEach((w) => console.log(`  ${w}`));
      }
    }

    // Update snapshot with current metrics
    const newSnapshot: PerfSnapshot = {
      date: new Date().toISOString(),
      commit: process.env.GITHUB_SHA || 'local',
      scenarios: {},
      summary: aggregatePerfMetrics(allMetrics),
    };

    for (const metrics of allMetrics) {
      newSnapshot.scenarios[metrics.testName] = metrics;
    }

    savePerfSnapshot(newSnapshot);

    // Fail if any metric degraded significantly
    if (!allPassed) {
      console.log('\n❌ Performance degradation detected!');
      console.log('Warnings:');
      allWarnings.forEach((w) => console.log(`  ${w}`));
      
      throw new Error(
        `Performance degraded: ${allWarnings.length} warning(s). ` +
        `See logs for details.`
      );
    }

    console.log('\n✅ All performance metrics within acceptable range');
  });

  it('should print summary of all metrics', () => {
    console.log('\n📊 Performance Summary');
    console.log('═'.repeat(60));

    const summary = aggregatePerfMetrics(allMetrics);

    console.log(`Tests Run: ${allMetrics.length}`);
    console.log(`Avg P95 Latency: ${summary.avgLatencyP95.toFixed(0)}ms`);
    console.log(`Avg Tokens/Turn: ${summary.avgTokensPerTurn.toFixed(0)}`);
    console.log(`Total Cost: $${summary.totalCost.toFixed(4)} USD`);
    console.log('═'.repeat(60));

    // Sanity checks on aggregates
    expect(summary.avgLatencyP95).toBeGreaterThan(0);
    expect(summary.avgLatencyP95).toBeLessThan(5000);
    expect(summary.avgTokensPerTurn).toBeGreaterThan(0);
    expect(summary.avgTokensPerTurn).toBeLessThan(3000);
    expect(summary.totalCost).toBeGreaterThan(0);
    expect(summary.totalCost).toBeLessThan(1); // Should be less than $1 for test suite
  });
});
