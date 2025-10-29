export type NegotiationRule = {
  anchor_copy?: string | null;
  sweetener_copy?: string | null;
  discount_steps: number[];
  risk_copy?: string | null;
  payment_options?: string[];
};

export type NegotiationState = {
  productId?: string;
  stage: 'anchor' | 'sweetener' | 'discount';
  concessionIndex: number;
};

export type RelaxationStep = {
  facet: string;
  previousValue?: string;
  description: string;
  undo?: { label: string; value: string };
};
