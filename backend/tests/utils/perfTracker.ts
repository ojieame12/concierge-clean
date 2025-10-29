/**
 * Performance & Cost Tracking Utility
 * 
 * Tracks latency (p50, p95, p99) and token usage across conversation tests.
 * Fails CI if metrics jump significantly week-over-week.
 * 
 * Usage:
 * ```typescript
 * const tracker = new PerfTracker();
 * await tracker.start();
 * // ... run conversation ...
 * await tracker.end();
 * const metrics = tracker.getMetrics();
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PerfMetrics {
  testName: string;
  timestamp: string;
  latency: {
    p50: number;
    p95: number;
    p99: number;
    mean: number;
    total: number;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
    perTurn: number;
  };
  turns: number;
  cost: {
    estimated: number; // USD
    currency: string;
  };
}

export interface PerfSnapshot {
  date: string;
  commit: string;
  scenarios: Record<string, PerfMetrics>;
  summary: {
    avgLatencyP95: number;
    avgTokensPerTurn: number;
    totalCost: number;
  };
}

export class PerfTracker {
  private startTime: number = 0;
  private endTime: number = 0;
  private turnLatencies: number[] = [];
  private turnTokens: { input: number; output: number }[] = [];
  private testName: string = '';

  constructor(testName?: string) {
    this.testName = testName || 'unknown';
  }

  /**
   * Start tracking for a new conversation
   */
  start() {
    this.startTime = Date.now();
    this.turnLatencies = [];
    this.turnTokens = [];
  }

  /**
   * Record a turn's latency and token usage
   */
  recordTurn(latencyMs: number, inputTokens: number, outputTokens: number) {
    this.turnLatencies.push(latencyMs);
    this.turnTokens.push({ input: inputTokens, output: outputTokens });
  }

  /**
   * End tracking
   */
  end() {
    this.endTime = Date.now();
  }

  /**
   * Calculate percentile
   */
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get collected metrics
   */
  getMetrics(): PerfMetrics {
    const totalLatency = this.endTime - this.startTime;
    const meanLatency =
      this.turnLatencies.length > 0
        ? this.turnLatencies.reduce((a, b) => a + b, 0) / this.turnLatencies.length
        : 0;

    const totalInputTokens = this.turnTokens.reduce((sum, t) => sum + t.input, 0);
    const totalOutputTokens = this.turnTokens.reduce((sum, t) => sum + t.output, 0);
    const totalTokens = totalInputTokens + totalOutputTokens;
    const tokensPerTurn = this.turnTokens.length > 0 ? totalTokens / this.turnTokens.length : 0;

    // Gemini 2.0 Flash pricing (approximate)
    // Input: $0.075 per 1M tokens
    // Output: $0.30 per 1M tokens
    const inputCost = (totalInputTokens / 1_000_000) * 0.075;
    const outputCost = (totalOutputTokens / 1_000_000) * 0.3;
    const estimatedCost = inputCost + outputCost;

    return {
      testName: this.testName,
      timestamp: new Date().toISOString(),
      latency: {
        p50: this.percentile(this.turnLatencies, 50),
        p95: this.percentile(this.turnLatencies, 95),
        p99: this.percentile(this.turnLatencies, 99),
        mean: meanLatency,
        total: totalLatency,
      },
      tokens: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalTokens,
        perTurn: tokensPerTurn,
      },
      turns: this.turnTokens.length,
      cost: {
        estimated: estimatedCost,
        currency: 'USD',
      },
    };
  }
}

/**
 * Load previous performance snapshot
 */
export function loadPerfSnapshot(): PerfSnapshot | null {
  const snapshotPath = path.join(__dirname, '../../perf-snapshots.json');
  
  if (!fs.existsSync(snapshotPath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(snapshotPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load perf snapshot:', error);
    return null;
  }
}

/**
 * Save performance snapshot
 */
export function savePerfSnapshot(snapshot: PerfSnapshot) {
  const snapshotPath = path.join(__dirname, '../../perf-snapshots.json');
  
  try {
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log('✅ Performance snapshot saved:', snapshotPath);
  } catch (error) {
    console.error('Failed to save perf snapshot:', error);
  }
}

/**
 * Compare current metrics against previous snapshot
 * Returns warnings if metrics have degraded significantly
 */
export function comparePerfMetrics(
  current: PerfMetrics,
  previous: PerfMetrics | undefined
): { passed: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!previous) {
    return { passed: true, warnings: ['No previous snapshot to compare against'] };
  }

  // Check p95 latency (fail if >20% increase)
  const latencyIncrease =
    ((current.latency.p95 - previous.latency.p95) / previous.latency.p95) * 100;
  
  if (latencyIncrease > 20) {
    warnings.push(
      `⚠️  P95 latency increased by ${latencyIncrease.toFixed(1)}% ` +
      `(${previous.latency.p95}ms → ${current.latency.p95}ms)`
    );
  }

  // Check tokens per turn (fail if >20% increase)
  const tokensIncrease =
    ((current.tokens.perTurn - previous.tokens.perTurn) / previous.tokens.perTurn) * 100;
  
  if (tokensIncrease > 20) {
    warnings.push(
      `⚠️  Tokens per turn increased by ${tokensIncrease.toFixed(1)}% ` +
      `(${previous.tokens.perTurn.toFixed(0)} → ${current.tokens.perTurn.toFixed(0)})`
    );
  }

  // Check cost (fail if >20% increase)
  const costIncrease =
    ((current.cost.estimated - previous.cost.estimated) / previous.cost.estimated) * 100;
  
  if (costIncrease > 20) {
    warnings.push(
      `⚠️  Estimated cost increased by ${costIncrease.toFixed(1)}% ` +
      `($${previous.cost.estimated.toFixed(4)} → $${current.cost.estimated.toFixed(4)})`
    );
  }

  const passed = warnings.length === 0;
  return { passed, warnings };
}

/**
 * Print performance metrics in a readable format
 */
export function printPerfMetrics(metrics: PerfMetrics) {
  console.log('\n📊 Performance Metrics');
  console.log('═'.repeat(60));
  console.log(`Test: ${metrics.testName}`);
  console.log(`Timestamp: ${metrics.timestamp}`);
  console.log(`Turns: ${metrics.turns}`);
  console.log('');
  console.log('Latency:');
  console.log(`  P50: ${metrics.latency.p50.toFixed(0)}ms`);
  console.log(`  P95: ${metrics.latency.p95.toFixed(0)}ms`);
  console.log(`  P99: ${metrics.latency.p99.toFixed(0)}ms`);
  console.log(`  Mean: ${metrics.latency.mean.toFixed(0)}ms`);
  console.log(`  Total: ${metrics.latency.total.toFixed(0)}ms`);
  console.log('');
  console.log('Tokens:');
  console.log(`  Input: ${metrics.tokens.input.toLocaleString()}`);
  console.log(`  Output: ${metrics.tokens.output.toLocaleString()}`);
  console.log(`  Total: ${metrics.tokens.total.toLocaleString()}`);
  console.log(`  Per Turn: ${metrics.tokens.perTurn.toFixed(0)}`);
  console.log('');
  console.log('Cost:');
  console.log(`  Estimated: $${metrics.cost.estimated.toFixed(4)} ${metrics.cost.currency}`);
  console.log('═'.repeat(60));
}

/**
 * Aggregate metrics from multiple tests
 */
export function aggregatePerfMetrics(metrics: PerfMetrics[]): {
  avgLatencyP95: number;
  avgTokensPerTurn: number;
  totalCost: number;
} {
  if (metrics.length === 0) {
    return { avgLatencyP95: 0, avgTokensPerTurn: 0, totalCost: 0 };
  }

  const avgLatencyP95 =
    metrics.reduce((sum, m) => sum + m.latency.p95, 0) / metrics.length;
  
  const avgTokensPerTurn =
    metrics.reduce((sum, m) => sum + m.tokens.perTurn, 0) / metrics.length;
  
  const totalCost = metrics.reduce((sum, m) => sum + m.cost.estimated, 0);

  return { avgLatencyP95, avgTokensPerTurn, totalCost };
}
