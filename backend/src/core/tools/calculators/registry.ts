import { z } from 'zod';
import type { CalculatorDescriptor } from '../../knowledge/types';

const cvInputSchema = z.object({
  flow_gpm: z.number().positive(),
  specific_gravity: z.number().positive().optional().default(1),
  delta_p_psi: z.number().positive(),
});

const cvCalculator: CalculatorDescriptor = {
  id: 'cv_from_flow',
  label: 'Valve flow coefficient',
  description: 'Computes required Cv to support a desired flow given specific gravity and pressure drop.',
  inputSchema: {
    flow_gpm: { type: 'number', required: true, unit: 'gpm', description: 'Desired flow rate' },
    specific_gravity: { type: 'number', required: false, description: 'Fluid specific gravity (default 1.0)' },
    delta_p_psi: { type: 'number', required: true, unit: 'psi', description: 'Allowable pressure drop across the valve' },
  },
  outputSchema: { cv_required: { type: 'number', unit: 'Cv' } },
  appliesTo: ['flow', 'valves', 'pumps'],
  handler: async (rawInput) => {
    const parsed = cvInputSchema.parse(rawInput);
    const sg = parsed.specific_gravity ?? 1;
    const cv = parsed.flow_gpm / Math.sqrt(sg * parsed.delta_p_psi);
    return {
      cv_required: Number(cv.toFixed(3)),
      formula: 'Cv = Q / sqrt(SG × ΔP)',
    };
  },
};

const torqueInputSchema = z.object({
  fastener_diameter_mm: z.number().positive(),
  desired_tension_kn: z.number().positive(),
  k_factor: z.number().positive().default(0.2),
});

const boltTorqueCalculator: CalculatorDescriptor = {
  id: 'bolt_torque',
  label: 'Bolt torque estimate',
  description: 'Estimates bolt torque (Nm) using T = K × D × F.',
  inputSchema: {
    fastener_diameter_mm: { type: 'number', required: true, unit: 'mm', description: 'Nominal fastener diameter' },
    desired_tension_kn: { type: 'number', required: true, unit: 'kN', description: 'Target clamp load' },
    k_factor: { type: 'number', required: false, description: 'Nut factor (defaults to 0.2)' },
  },
  outputSchema: { torque_nm: { type: 'number', unit: 'Nm' } },
  appliesTo: ['fasteners', 'mechanical'],
  handler: async (rawInput) => {
    const parsed = torqueInputSchema.parse(rawInput);
    const diameterMeters = parsed.fastener_diameter_mm / 1000;
    const forceNewton = parsed.desired_tension_kn * 1000;
    const torqueNm = parsed.k_factor * diameterMeters * forceNewton;
    return {
      torque_nm: Number(torqueNm.toFixed(2)),
      formula: 'T = K × D × F',
    };
  },
};

const temperatureInputSchema = z.object({
  celsius: z.number().optional(),
  fahrenheit: z.number().optional(),
});

const temperatureCalculator: CalculatorDescriptor = {
  id: 'temperature_convert',
  label: 'Temperature conversion',
  description: 'Converts between Celsius and Fahrenheit.',
  inputSchema: {
    celsius: { type: 'number', required: false, unit: '°C' },
    fahrenheit: { type: 'number', required: false, unit: '°F' },
  },
  outputSchema: {
    celsius: { type: 'number', unit: '°C' },
    fahrenheit: { type: 'number', unit: '°F' },
  },
  appliesTo: ['environment', 'temperature'],
  handler: async (rawInput) => {
    const parsed = temperatureInputSchema.parse(rawInput);
    if (parsed.celsius != null) {
      return {
        celsius: parsed.celsius,
        fahrenheit: Number(((parsed.celsius * 9) / 5 + 32).toFixed(2)),
      };
    }
    if (parsed.fahrenheit != null) {
      return {
        celsius: Number((((parsed.fahrenheit - 32) * 5) / 9).toFixed(2)),
        fahrenheit: parsed.fahrenheit,
      };
    }
    throw new Error('Expected celsius or fahrenheit');
  },
};

export const defaultCalculators: CalculatorDescriptor[] = [cvCalculator, boltTorqueCalculator, temperatureCalculator];

export const findCalculator = (id: string) => defaultCalculators.find((calculator) => calculator.id === id) ?? null;
