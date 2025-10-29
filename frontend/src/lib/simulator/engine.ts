import type { Scenario, ScenarioStep, SimulatorState } from './types';
import type { Segment } from '@insite/concierge-ui/types/conversation';

export class MockConversationEngine {
  private scenario: Scenario;
  private state: SimulatorState;
  private onStateChange: (state: SimulatorState) => void;

  constructor(scenario: Scenario, onStateChange: (state: SimulatorState) => void) {
    this.scenario = scenario;
    this.onStateChange = onStateChange;
    this.state = {
      currentStep: 0,
      messages: [],
      segments: [],
      isPlaying: false,
    };
  }

  reset() {
    this.state = {
      currentStep: 0,
      messages: [],
      segments: [],
      isPlaying: false,
    };
    this.notifyChange();
  }

  async sendMessage(content: string) {
    if (this.state.currentStep >= this.scenario.steps.length) {
      console.warn('[Simulator] No more steps in scenario');
      return;
    }

    // Add user message
    this.state.messages.push({
      role: 'user',
      content,
      timestamp: new Date(),
    });
    this.state.isPlaying = true;
    this.notifyChange();

    // Get current step
    const step = this.scenario.steps[this.state.currentStep];

    // Simulate streaming delay
    await this.delay(step.response.streamDelay || 50);

    // Stream segments one by one
    const newSegments: Segment[] = [];
    for (const segment of step.response.segments) {
      newSegments.push(segment);
      this.state.segments = [...newSegments];
      this.notifyChange();
      await this.delay(100); // Simulate SSE stream
    }

    // Add assistant message
    const narrativeText = this.extractNarrative(step.response.segments);
    this.state.messages.push({
      role: 'assistant',
      content: narrativeText,
      timestamp: new Date(),
    });

    // Move to next step
    this.state.currentStep++;
    this.state.isPlaying = false;
    this.notifyChange();
  }

  jumpToStep(stepIndex: number) {
    if (stepIndex < 0 || stepIndex >= this.scenario.steps.length) return;

    this.reset();

    // Fast-forward to that step
    for (let i = 0; i < stepIndex; i++) {
      const step = this.scenario.steps[i];
      this.state.messages.push(
        { role: 'user', content: step.userMessage, timestamp: new Date() },
        { role: 'assistant', content: this.extractNarrative(step.response.segments), timestamp: new Date() }
      );
    }

    this.state.currentStep = stepIndex;
    this.notifyChange();
  }

  private extractNarrative(segments: Segment[]): string {
    const narrative = segments.find(s => s.type === 'narrative');
    return narrative && narrative.type === 'narrative' ? narrative.text : 'Assistant responded';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private notifyChange() {
    this.onStateChange({ ...this.state });
  }

  getState(): SimulatorState {
    return { ...this.state };
  }

  getScenario(): Scenario {
    return this.scenario;
  }
}
