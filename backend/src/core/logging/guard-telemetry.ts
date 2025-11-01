/**
 * Logging utility for style guard telemetry
 * 
 * Tracks guard execution, modifications, and errors for observability
 */

import type { GuardTelemetry } from '../conversation/style-guards';

export interface GuardLogEntry {
  timestamp: string;
  shopId: string;
  sessionId: string;
  turnId: string;
  telemetry: GuardTelemetry;
}

/**
 * Log style guard telemetry for observability
 */
export function logGuardTelemetry(entry: GuardLogEntry): void {
  const { timestamp, shopId, sessionId, turnId, telemetry } = entry;
  
  // Log summary
  console.log('[StyleGuards]', {
    timestamp,
    shopId,
    sessionId,
    turnId,
    guardsApplied: telemetry.guardsApplied,
    modificationCount: telemetry.modifications.length,
    errorCount: telemetry.errors.length,
    executionTimeMs: telemetry.executionTimeMs,
  });
  
  // Log individual modifications for debugging
  if (telemetry.modifications.length > 0) {
    console.log('[StyleGuards:Modifications]', {
      turnId,
      modifications: telemetry.modifications.map(m => ({
        guard: m.guard,
        field: m.field,
        reason: m.reason,
        // Truncate before/after for readability
        beforePreview: m.before.slice(0, 50) + (m.before.length > 50 ? '...' : ''),
        afterPreview: m.after.slice(0, 50) + (m.after.length > 50 ? '...' : ''),
      })),
    });
  }
  
  // Log errors
  if (telemetry.errors.length > 0) {
    console.error('[StyleGuards:Errors]', {
      turnId,
      errors: telemetry.errors,
    });
  }
}

/**
 * Format guard telemetry for inclusion in API response metadata
 */
export function formatGuardTelemetryForAPI(telemetry: GuardTelemetry): {
  guards_applied: string[];
  modification_count: number;
  execution_time_ms: number;
  has_errors: boolean;
} {
  return {
    guards_applied: telemetry.guardsApplied,
    modification_count: telemetry.modifications.length,
    execution_time_ms: telemetry.executionTimeMs,
    has_errors: telemetry.errors.length > 0,
  };
}

/**
 * Calculate guard effectiveness metrics
 */
export function calculateGuardMetrics(telemetry: GuardTelemetry): {
  totalGuards: number;
  activeGuards: number;
  avgExecutionTimeMs: number;
  errorRate: number;
} {
  const totalGuards = telemetry.guardsApplied.length;
  const activeGuards = new Set(telemetry.modifications.map(m => m.guard)).size;
  
  return {
    totalGuards,
    activeGuards,
    avgExecutionTimeMs: totalGuards > 0 ? telemetry.executionTimeMs / totalGuards : 0,
    errorRate: telemetry.errors.length / Math.max(totalGuards, 1),
  };
}
