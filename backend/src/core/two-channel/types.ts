/**
 * Two-Channel Architecture Types
 *
 * Separates control (what to show) from copy (how to say it)
 */

export type TurnMode = 'chat' | 'clarify' | 'recommend' | 'compare' | 'dead_end';

export interface TurnSkeleton {
  mode: TurnMode;
  ask?: {
    facet: string;
    question: string;
    options: Array<{ label: string; value: string }>;
  };
  products?: Array<{
    id: string;
    title: string;
    price: number;
    image?: string;
    reason?: string;
    why_chips?: string[];
  }>;
  notices?: Array<{
    type: 'relaxation' | 'oos' | 'policy';
    message: string;
    action?: { label: string; value: string };
  }>;
  compare?: {
    productIds: string[];
    differentiators: string[];
  };
  telemetry: {
    domainConfidence: number;
    groundability: number;
    candidateCount: number;
    facetEntropy?: Record<string, number>;
    mode: TurnMode;
  };
}

export interface CopyBrief {
  mode: TurnMode;
  brandVoice: {
    tone: string; // 'friendly' | 'professional' | 'balanced'
    style: string; // 'concise' | 'detailed'
  };
  counts: {
    productCount?: number;
    optionCount?: number;
  };
  contextSnippets: string[]; // Max 3 grounded facts
  askPreview?: string; // The question text (for coherence)
  cautions?: string[]; // Things NOT to do
}

export interface CopyOut {
  lead: string; // ≤18 words
  detail: string; // ≤45 words
}

export interface RouterSignals {
  lexicalScoreTop: number; // from ts_rank_cd
  vectorScoreTop: number; // cosine similarity
  coverage: number; // % of top-8 above threshold
  candidateCount: number;
  facetEntropy: Record<string, number>;
  asked: string[]; // Already asked facets
}

export interface GroundabilityMetrics {
  domainConfidence: number; // 0-1
  groundability: number; // 0-1
  inDomain: boolean; // > 0.35 threshold
}

export interface PhraseBank {
  opener: (mode: TurnMode, counts?: { productCount?: number }) => string;
  detail: (mode: TurnMode, counts?: { productCount?: number }) => string;
  fallback: string;
}
