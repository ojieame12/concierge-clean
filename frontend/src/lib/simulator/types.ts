import type { Segment } from '@insite/concierge-ui/types/conversation';

export interface ScenarioStep {
  userMessage: string;
  triggerDelay?: number;  // ms before auto-advancing
  response: {
    streamDelay?: number;  // ms between segments (simulate SSE)
    segments: Segment[];
  };
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  steps: ScenarioStep[];
}

export interface SimulatorState {
  currentStep: number;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  segments: Segment[];
  isPlaying: boolean;
}
