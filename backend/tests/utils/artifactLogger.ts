/**
 * Artifact Logger for CI Debugging
 * 
 * Logs conversation transcripts, judge scores, and retrieval logs to files
 * that can be uploaded as CI artifacts for debugging red builds.
 * 
 * Usage:
 * ```typescript
 * const logger = new ArtifactLogger('CONV-RUN-01');
 * logger.logTurn('user', 'I need running shoes');
 * logger.logTurn('assistant', 'Great! What's your budget?');
 * logger.logJudgeScore('naturalness', 4.2, ['Natural tone', 'Good contractions']);
 * logger.logRetrievalIds(['prod1', 'prod2', 'prod3']);
 * await logger.save();
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface JudgeScoreLog {
  judge: string;
  score: number;
  reasons: string[];
  timestamp: string;
}

export interface RetrievalLog {
  productIds: string[];
  timestamp: string;
}

export class ArtifactLogger {
  private testName: string;
  private turns: ConversationTurn[] = [];
  private judgeScores: JudgeScoreLog[] = [];
  private retrievalLogs: RetrievalLog[] = [];
  private metadata: Record<string, any> = {};

  constructor(testName: string) {
    this.testName = testName;
  }

  /**
   * Log a conversation turn
   */
  logTurn(role: 'user' | 'assistant', content: string) {
    this.turns.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log a judge score
   */
  logJudgeScore(judge: string, score: number, reasons: string[]) {
    this.judgeScores.push({
      judge,
      score,
      reasons,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log retrieved product IDs
   */
  logRetrievalIds(productIds: string[]) {
    this.retrievalLogs.push({
      productIds,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Add metadata
   */
  addMetadata(key: string, value: any) {
    this.metadata[key] = value;
  }

  /**
   * Save all logs to artifact files
   */
  async save() {
    const artifactDir = path.join(__dirname, '../../artifacts');
    
    // Create artifacts directory if it doesn't exist
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    // Save conversation transcript
    const transcriptPath = path.join(artifactDir, `${this.testName}.transcript.md`);
    const transcript = this.generateTranscript();
    fs.writeFileSync(transcriptPath, transcript, 'utf-8');

    // Save judge scores
    const judgeScoresPath = path.join(artifactDir, `${this.testName}.judges.json`);
    fs.writeFileSync(
      judgeScoresPath,
      JSON.stringify(this.judgeScores, null, 2),
      'utf-8'
    );

    // Save retrieval logs
    if (this.retrievalLogs.length > 0) {
      const retrievalPath = path.join(artifactDir, `${this.testName}.retrieval.json`);
      fs.writeFileSync(
        retrievalPath,
        JSON.stringify(this.retrievalLogs, null, 2),
        'utf-8'
      );
    }

    // Save metadata
    if (Object.keys(this.metadata).length > 0) {
      const metadataPath = path.join(artifactDir, `${this.testName}.metadata.json`);
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(this.metadata, null, 2),
        'utf-8'
      );
    }

    console.log(`✅ Artifacts saved for ${this.testName}`);
  }

  /**
   * Generate human-readable transcript
   */
  private generateTranscript(): string {
    let transcript = `# Conversation Transcript: ${this.testName}\n\n`;
    transcript += `**Date:** ${new Date().toISOString()}\n\n`;

    if (Object.keys(this.metadata).length > 0) {
      transcript += `## Metadata\n\n`;
      transcript += '```json\n';
      transcript += JSON.stringify(this.metadata, null, 2);
      transcript += '\n```\n\n';
    }

    transcript += `## Conversation\n\n`;

    for (const turn of this.turns) {
      const emoji = turn.role === 'user' ? '👤' : '🤖';
      transcript += `### ${emoji} ${turn.role.toUpperCase()}\n\n`;
      transcript += `${turn.content}\n\n`;
      transcript += `*${turn.timestamp}*\n\n`;
      transcript += `---\n\n`;
    }

    if (this.judgeScores.length > 0) {
      transcript += `## Judge Scores\n\n`;

      for (const score of this.judgeScores) {
        transcript += `### ${score.judge}: ${score.score.toFixed(1)}/5.0\n\n`;
        transcript += `**Reasons:**\n`;
        for (const reason of score.reasons) {
          transcript += `- ${reason}\n`;
        }
        transcript += `\n*${score.timestamp}*\n\n`;
      }
    }

    if (this.retrievalLogs.length > 0) {
      transcript += `## Retrieval Logs\n\n`;

      for (let i = 0; i < this.retrievalLogs.length; i++) {
        const log = this.retrievalLogs[i];
        transcript += `### Retrieval ${i + 1}\n\n`;
        transcript += `**Product IDs:** ${log.productIds.join(', ')}\n\n`;
        transcript += `*${log.timestamp}*\n\n`;
      }
    }

    return transcript;
  }
}

/**
 * Global artifact logger for use across tests
 */
let globalLogger: ArtifactLogger | null = null;

export function getGlobalArtifactLogger(testName?: string): ArtifactLogger {
  if (!globalLogger || (testName && globalLogger['testName'] !== testName)) {
    globalLogger = new ArtifactLogger(testName || 'unknown');
  }
  return globalLogger;
}

export function resetGlobalArtifactLogger() {
  globalLogger = null;
}
