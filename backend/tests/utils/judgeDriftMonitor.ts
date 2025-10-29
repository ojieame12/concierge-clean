/**
 * Judge Drift Monitoring Utility
 * 
 * Tracks LLM judge scores over time and alerts on significant drift.
 * Even with maxWorkers: 1, model upgrades can shift scores.
 * 
 * Usage:
 * ```typescript
 * const monitor = new JudgeDriftMonitor();
 * monitor.recordScore('CONV-RUN-01', 'naturalness', 4.2);
 * monitor.recordScore('CONV-RUN-01', 'recommendations', 4.5);
 * await monitor.save();
 * const drift = monitor.checkDrift();
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';

export interface JudgeScore {
  scenario: string;
  judge: string;
  score: number;
  timestamp: string;
}

export interface JudgeSnapshot {
  date: string;
  commit: string;
  modelVersion: string;
  scores: Record<string, Record<string, number>>; // scenario -> judge -> median score
}

export interface DriftAlert {
  scenario: string;
  judge: string;
  previousScore: number;
  currentScore: number;
  drift: number; // Absolute difference
  driftPercent: number;
  severity: 'info' | 'warning' | 'critical';
}

export class JudgeDriftMonitor {
  private scores: JudgeScore[] = [];
  private snapshotPath: string;

  constructor() {
    this.snapshotPath = path.join(__dirname, '../../judge-snapshots.json');
  }

  /**
   * Record a judge score
   */
  recordScore(scenario: string, judge: string, score: number) {
    this.scores.push({
      scenario,
      judge,
      score,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Calculate median score for a scenario+judge combination
   */
  private getMedianScore(scenario: string, judge: string): number {
    const relevantScores = this.scores
      .filter((s) => s.scenario === scenario && s.judge === judge)
      .map((s) => s.score)
      .sort((a, b) => a - b);

    if (relevantScores.length === 0) return 0;

    const mid = Math.floor(relevantScores.length / 2);
    if (relevantScores.length % 2 === 0) {
      return (relevantScores[mid - 1] + relevantScores[mid]) / 2;
    } else {
      return relevantScores[mid];
    }
  }

  /**
   * Load previous snapshot
   */
  loadSnapshot(): JudgeSnapshot | null {
    if (!fs.existsSync(this.snapshotPath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(this.snapshotPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load judge snapshot:', error);
      return null;
    }
  }

  /**
   * Save current snapshot
   */
  save() {
    // Group scores by scenario and judge
    const scoresByScenario: Record<string, Record<string, number>> = {};

    const scenarios = [...new Set(this.scores.map((s) => s.scenario))];
    const judges = [...new Set(this.scores.map((s) => s.judge))];

    for (const scenario of scenarios) {
      scoresByScenario[scenario] = {};
      for (const judge of judges) {
        const median = this.getMedianScore(scenario, judge);
        if (median > 0) {
          scoresByScenario[scenario][judge] = median;
        }
      }
    }

    const snapshot: JudgeSnapshot = {
      date: new Date().toISOString(),
      commit: process.env.GITHUB_SHA || 'local',
      modelVersion: 'gemini-2.0-flash', // Could be dynamic
      scores: scoresByScenario,
    };

    try {
      fs.writeFileSync(
        this.snapshotPath,
        JSON.stringify(snapshot, null, 2),
        'utf-8'
      );
      console.log('✅ Judge snapshot saved:', this.snapshotPath);
    } catch (error) {
      console.error('Failed to save judge snapshot:', error);
    }
  }

  /**
   * Check for drift against previous snapshot
   * Returns alerts for significant changes
   */
  checkDrift(): DriftAlert[] {
    const previous = this.loadSnapshot();
    if (!previous) {
      console.log('⚠️  No previous judge snapshot found. Creating baseline...');
      return [];
    }

    const alerts: DriftAlert[] = [];

    // Group current scores
    const scenarios = [...new Set(this.scores.map((s) => s.scenario))];
    const judges = [...new Set(this.scores.map((s) => s.judge))];

    for (const scenario of scenarios) {
      for (const judge of judges) {
        const currentScore = this.getMedianScore(scenario, judge);
        const previousScore = previous.scores[scenario]?.[judge];

        if (!previousScore || currentScore === 0) continue;

        const drift = currentScore - previousScore;
        const driftPercent = (drift / previousScore) * 100;

        // Determine severity
        let severity: 'info' | 'warning' | 'critical' = 'info';
        if (Math.abs(drift) >= 1.0) {
          severity = 'critical'; // ≥1.0 point drift
        } else if (Math.abs(drift) >= 0.5) {
          severity = 'warning'; // ≥0.5 point drift
        }

        if (Math.abs(drift) >= 0.3) {
          // Only alert on ≥0.3 drift
          alerts.push({
            scenario,
            judge,
            previousScore,
            currentScore,
            drift,
            driftPercent,
            severity,
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Print drift report
   */
  printDriftReport(alerts: DriftAlert[]) {
    if (alerts.length === 0) {
      console.log('\n✅ No significant judge drift detected');
      return;
    }

    console.log('\n📊 Judge Drift Report');
    console.log('═'.repeat(80));

    const critical = alerts.filter((a) => a.severity === 'critical');
    const warnings = alerts.filter((a) => a.severity === 'warning');
    const info = alerts.filter((a) => a.severity === 'info');

    if (critical.length > 0) {
      console.log('\n🚨 CRITICAL DRIFT (≥1.0 points):');
      for (const alert of critical) {
        console.log(
          `  ${alert.scenario} / ${alert.judge}: ` +
          `${alert.previousScore.toFixed(2)} → ${alert.currentScore.toFixed(2)} ` +
          `(${alert.drift >= 0 ? '+' : ''}${alert.drift.toFixed(2)}, ` +
          `${alert.driftPercent >= 0 ? '+' : ''}${alert.driftPercent.toFixed(1)}%)`
        );
      }
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  WARNING (≥0.5 points):');
      for (const alert of warnings) {
        console.log(
          `  ${alert.scenario} / ${alert.judge}: ` +
          `${alert.previousScore.toFixed(2)} → ${alert.currentScore.toFixed(2)} ` +
          `(${alert.drift >= 0 ? '+' : ''}${alert.drift.toFixed(2)}, ` +
          `${alert.driftPercent >= 0 ? '+' : ''}${alert.driftPercent.toFixed(1)}%)`
        );
      }
    }

    if (info.length > 0) {
      console.log('\nℹ️  INFO (≥0.3 points):');
      for (const alert of info) {
        console.log(
          `  ${alert.scenario} / ${alert.judge}: ` +
          `${alert.previousScore.toFixed(2)} → ${alert.currentScore.toFixed(2)} ` +
          `(${alert.drift >= 0 ? '+' : ''}${alert.drift.toFixed(2)}, ` +
          `${alert.driftPercent >= 0 ? '+' : ''}${alert.driftPercent.toFixed(1)}%)`
        );
      }
    }

    console.log('═'.repeat(80));
  }

  /**
   * Fail CI if critical drift detected
   */
  failOnCriticalDrift(alerts: DriftAlert[]) {
    const critical = alerts.filter((a) => a.severity === 'critical');
    
    if (critical.length > 0) {
      throw new Error(
        `Critical judge drift detected in ${critical.length} scenario(s). ` +
        `This may indicate model version change or prompt regression. ` +
        `Review drift report above.`
      );
    }
  }
}

/**
 * Global monitor instance for use across tests
 */
let globalMonitor: JudgeDriftMonitor | null = null;

export function getGlobalMonitor(): JudgeDriftMonitor {
  if (!globalMonitor) {
    globalMonitor = new JudgeDriftMonitor();
  }
  return globalMonitor;
}

export function resetGlobalMonitor() {
  globalMonitor = null;
}
