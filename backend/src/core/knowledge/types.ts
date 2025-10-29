export interface CalculatorFieldDefinition {
  type: 'number' | 'string';
  required: boolean;
  description?: string;
  unit?: string;
  min?: number;
  max?: number;
}

export interface CalculatorDescriptor {
  id: string;
  label: string;
  description: string;
  inputSchema: Record<string, CalculatorFieldDefinition>;
  outputSchema: Record<string, { type: string; unit?: string }>;
  handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  appliesTo: string[];
}

export interface OntologyAttribute {
  id: string;
  label: string;
  type: 'string' | 'number' | 'enum';
  unit?: string | null;
  allowedValues?: string[];
  synonyms?: string[];
  description?: string | null;
}

export interface OntologyDefinition {
  version: string;
  generatedAt: string;
  attributes: OntologyAttribute[];
  facetOrderByCategory: Record<string, string[]>;
  normalizers: Record<string, { pattern: string; canonical: string }[]>;
}

export interface UnitRule {
  attributeId: string;
  sourceUnit: string;
  targetUnit: string;
  multiplier: number;
  offset?: number;
  precision?: number;
}

export interface KnowledgePack {
  productId: string;
  normalizedSpecs: Record<string, string | number | null>;
  derivedMetrics: Record<string, number | null>;
  whyReasons: Array<{ text: string; source: string }>;
  evidence: Array<{ key: string; snippet?: string | null; confidence?: number | null }>;
}

export interface CanonShard {
  topic: string;
  tags: string[];
  assertions: string[];
  caveats: string[];
  citation?: string;
  embedding?: number[];
}

export interface EnrichmentArtifacts {
  ontology: OntologyDefinition;
  unitRules: UnitRule[];
  knowledgePacks: KnowledgePack[];
  canonShards: CanonShard[];
  calculators: CalculatorDescriptor[];
}
