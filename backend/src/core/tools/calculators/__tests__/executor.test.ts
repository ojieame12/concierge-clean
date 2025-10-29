import { describe, it, expect } from 'vitest';

import { detectAndRunCalculators } from '../executor';
import { defaultCalculators } from '../registry';

describe('detectAndRunCalculators', () => {
  it('runs Cv calculator when flow and pressure are provided', async () => {
    const calculators = defaultCalculators.filter((calculator) => calculator.id === 'cv_from_flow');
    const results = await detectAndRunCalculators('Need Cv for 12 gpm at 8 psi, SG 1.1', calculators);
    expect(results).toHaveLength(1);
    expect(results[0]?.outputs.cv_required).toBeDefined();
  });

  it('converts metric flow and pressure before running Cv calculator', async () => {
    const calculators = defaultCalculators.filter((calculator) => calculator.id === 'cv_from_flow');
    const results = await detectAndRunCalculators('Cv for 45 L/min at 0.8 bar', calculators);
    expect(results).toHaveLength(1);
    const inputs = results[0]?.inputs ?? {};
    expect(inputs.flow_gpm).toBeCloseTo(45 * 0.264172, 3);
    expect(inputs.delta_p_psi).toBeCloseTo(0.8 * 14.5038, 3);
    expect(results[0]?.outputs.cv_required).toBeDefined();
  });

  it('converts temperatures in user message', async () => {
    const calculators = defaultCalculators.filter((calculator) => calculator.id === 'temperature_convert');
    const results = await detectAndRunCalculators('Convert 212 Fahrenheit to metric please', calculators);
    expect(results[0]?.outputs.celsius).toBeCloseTo(100, 4);
  });
});
