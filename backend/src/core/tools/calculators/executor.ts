import type { CalculatorDescriptor } from '../../knowledge/types';

export interface CalculatorExecutionResult {
  id: string;
  label: string;
  inputs: Record<string, number>;
  outputs: Record<string, unknown>;
  description?: string;
}

const parseNumber = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/[, ]+/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const detectCvInputs = (message: string) => {
  const flowMatch = message.match(/(-?\d+(?:\.\d+)?)\s*(gpm|gallons?\s+per\s+minute|lpm|l\/min|lit(?:er|re)s?\s+per\s+minute)/i);
  const deltaMatch = message.match(/(-?\d+(?:\.\d+)?)\s*(psi|pounds?\s+per\s+square\s+inch|bar|kpa|kilopascals?)/i);
  if (!flowMatch || !deltaMatch) return null;
  const sgMatch = message.match(/specific\s+gravity\s*(?:of|=)?\s*(-?\d+(?:\.\d+)?)/i)
    ?? message.match(/sg\s*[:=]\s*(-?\d+(?:\.\d+)?)/i);

  const flowRaw = parseNumber(flowMatch[1]);
  const deltaRaw = parseNumber(deltaMatch[1]);
  if (flowRaw == null || deltaRaw == null) return null;

  const flowUnit = flowMatch[2]?.toLowerCase() ?? 'gpm';
  const deltaUnit = deltaMatch[2]?.toLowerCase() ?? 'psi';

  const flowGpm = /lpm|l\/min|lit/.test(flowUnit)
    ? flowRaw * 0.264172
    : flowRaw;

  const deltaPsi = /bar/.test(deltaUnit)
    ? deltaRaw * 14.5038
    : /kpa|kilopascal/.test(deltaUnit)
      ? deltaRaw * 0.145038
      : deltaRaw;

  const inputs: Record<string, number> = {
    flow_gpm: flowGpm,
    delta_p_psi: deltaPsi,
  };
  const sg = sgMatch ? parseNumber(sgMatch[1]) : null;
  if (sg != null) {
    inputs.specific_gravity = sg;
  }
  return inputs;
};

const detectTemperatureInput = (message: string) => {
  const match = message.match(/(-?\d+(?:\.\d+)?)\s*(?:°\s*F|deg(?:ree)?\s*F|fahrenheit)/i);
  if (match) {
    const value = parseNumber(match[1]);
    if (value != null) {
      return { fahrenheit: value } as Record<string, number>;
    }
  }
  const cMatch = message.match(/(-?\d+(?:\.\d+)?)\s*(?:°\s*C|deg(?:ree)?\s*C|celsius)/i);
  if (cMatch) {
    const value = parseNumber(cMatch[1]);
    if (value != null) {
      return { celsius: value } as Record<string, number>;
    }
  }
  return null;
};

const detectBoltTorqueInputs = (message: string) => {
  const diameterMatch = message.match(/(\d+(?:\.\d+)?)\s*(?:mm|millimet(?:er|re)s?)/i);
  const tensionMatch = message.match(/(\d+(?:\.\d+)?)\s*(?:kn|kilo\s*newtons?)/i);
  if (!diameterMatch || !tensionMatch) return null;

  const diameter = parseNumber(diameterMatch[1]);
  const tension = parseNumber(tensionMatch[1]);
  if (diameter == null || tension == null) return null;

  const kMatch = message.match(/k\s*-?factor\s*(?:of|=)?\s*(\d+(?:\.\d+)?)/i)
    ?? message.match(/k\s*=\s*(\d+(?:\.\d+)?)/i);
  const inputs: Record<string, number> = {
    fastener_diameter_mm: diameter,
    desired_tension_kn: tension,
  };
  const kFactor = kMatch ? parseNumber(kMatch[1]) : null;
  if (kFactor != null) {
    inputs.k_factor = kFactor;
  }
  return inputs;
};

const detectors: Record<string, (message: string) => Record<string, number> | null> = {
  cv_from_flow: detectCvInputs,
  temperature_convert: detectTemperatureInput,
  bolt_torque: detectBoltTorqueInputs,
};

export const detectAndRunCalculators = async (
  message: string,
  calculators: CalculatorDescriptor[]
): Promise<CalculatorExecutionResult[]> => {
  if (!calculators.length) return [];

  const results: CalculatorExecutionResult[] = [];
  for (const calculator of calculators) {
    const detector = detectors[calculator.id];
    if (!detector) continue;
    const inputs = detector(message);
    if (!inputs) continue;

    try {
      const outputs = await calculator.handler(inputs);
      results.push({
        id: calculator.id,
        label: calculator.label,
        inputs,
        outputs,
        description: calculator.description,
      });
    } catch (error) {
      console.warn('[calculator-executor] failed to run calculator', calculator.id, (error as Error).message);
    }
  }
  return results;
};
