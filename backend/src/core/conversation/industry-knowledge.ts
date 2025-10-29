import type { Product } from './types';

/**
 * Industry Knowledge Module
 *
 * Provides expert understanding of product attributes and how they match user needs.
 * Transforms generic product specs into contextual guidance.
 */

export interface ProductSpecs {
  flex?: 'soft' | 'medium' | 'stiff';
  shape?: 'twin' | 'directional' | 'directional twin';
  camber?: 'traditional' | 'rocker' | 'hybrid' | 'flat';
  level?: 'beginner' | 'intermediate' | 'advanced';
}

export interface UserContext {
  skillLevel?: string;
  conditions?: string;
  useCase?: string;
  budget?: number;
}

/**
 * Extract product specifications from tags, description, and summary
 */
export function extractSpecsFromProduct(product: Product): ProductSpecs {
  const tags = product.tags?.join(' ').toLowerCase() || '';
  const description = product.description?.toLowerCase() || '';
  const summary = JSON.stringify(product.summary || {}).toLowerCase();
  const combined = `${tags} ${description} ${summary}`;

  return {
    flex: combined.includes('soft flex') || combined.includes('soft-flex') ? 'soft' :
          combined.includes('stiff') ? 'stiff' :
          combined.includes('medium') ? 'medium' : undefined,

    shape: combined.includes('true twin') ? 'twin' :
           combined.includes('directional twin') ? 'directional twin' :
           combined.includes('directional') ? 'directional' : undefined,

    camber: combined.includes('rocker') || combined.includes('reverse camber') ? 'rocker' :
            combined.includes('hybrid') || combined.includes('combo') ? 'hybrid' :
            combined.includes('traditional camber') || combined.includes('camber profile') ? 'traditional' :
            combined.includes('flat') ? 'flat' : undefined,

    level: combined.includes('beginner') ? 'beginner' :
           combined.includes('advanced') || combined.includes('expert') ? 'advanced' :
           combined.includes('intermediate') ? 'intermediate' : undefined
  };
}

/**
 * Generate contextual product reasoning based on user needs
 */
export function generateContextualReason(
  product: Product,
  userContext: UserContext
): string {
  const specs = extractSpecsFromProduct(product);
  const reasons: string[] = [];

  // Skill level + flex matching
  if (userContext.skillLevel === 'beginner') {
    if (specs.flex === 'soft') {
      reasons.push("Soft flex won't punish your mistakes");
    } else if (specs.flex === 'medium') {
      reasons.push("Medium flex grows with you as you improve");
    } else if (specs.flex === 'stiff') {
      reasons.push("Stiff flex may be challenging while learning");
    }

    if (specs.camber === 'rocker') {
      reasons.push("Rocker camber is very forgiving");
    } else if (specs.camber === 'hybrid') {
      reasons.push("Hybrid camber balances forgiveness and control");
    }

    if (specs.level === 'beginner') {
      reasons.push("Designed specifically for beginners");
    }
  }

  if (userContext.skillLevel === 'intermediate') {
    if (specs.flex === 'medium') {
      reasons.push("Versatile flex for progression");
    }
    if (specs.shape === 'directional twin') {
      reasons.push("Great all-around shape");
    }
  }

  if (userContext.skillLevel === 'advanced') {
    if (specs.flex === 'stiff') {
      reasons.push("Stiff flex for precision and power");
    }
    if (specs.camber === 'traditional') {
      reasons.push("Traditional camber for aggressive riding");
    }
  }

  // Conditions matching
  if (userContext.conditions === 'icy' || userContext.conditions === 'ice') {
    if (specs.camber === 'traditional' || specs.camber === 'hybrid') {
      reasons.push("Solid edge hold on hard pack");
    }
    if (specs.flex === 'stiff' || specs.flex === 'medium') {
      reasons.push("Stable on icy slopes");
    }
  }

  if (userContext.conditions === 'powder') {
    if (specs.camber === 'rocker') {
      reasons.push("Floats effortlessly in deep snow");
    }
    if (specs.shape === 'directional') {
      reasons.push("Directional shape keeps nose up");
    }
  }

  if (userContext.conditions === 'park' || userContext.conditions === 'freestyle') {
    if (specs.shape === 'twin') {
      reasons.push("True twin for landing switch");
    }
    if (specs.flex === 'soft' || specs.flex === 'medium') {
      reasons.push("Playful flex for tricks");
    }
  }

  if (userContext.conditions === 'all-mountain' || userContext.conditions === 'groomer') {
    if (specs.camber === 'hybrid') {
      reasons.push("Hybrid camber handles everything");
    }
    if (specs.shape === 'directional twin') {
      reasons.push("Versatile shape for any terrain");
    }
  }

  // Budget value proposition
  if (userContext.budget && product.price) {
    if (product.price < userContext.budget * 0.7) {
      reasons.push("Great value well under budget");
    } else if (product.price < userContext.budget) {
      reasons.push("Within your budget");
    }
  }

  // Combine top 2 reasons, or fallback
  if (reasons.length >= 2) {
    return reasons.slice(0, 2).join(', ');
  } else if (reasons.length === 1) {
    return reasons[0];
  }

  // Fallback to product summary or generic
  return product.summary?.bestFor?.[0] ||
         product.summary?.keyFeatures?.[0] ||
         `${product.vendor || ''} ${product.product_type || 'product'}`.trim() ||
         'Quality option';
}

/**
 * Generate expert guidance for user scenarios
 */
export function generateExpertGuidance(userContext: UserContext): string | null {
  const { skillLevel, conditions } = userContext;

  // Beginner + conditions guidance
  if (skillLevel === 'beginner') {
    if (conditions === 'icy' || conditions === 'ice') {
      return "For beginners on ice: Look for softer flex and rocker/hybrid camber—they're more forgiving when you catch an edge.";
    }
    if (conditions === 'powder') {
      return "For beginners in powder: Start with an all-mountain board first. Powder boards are specialized and harder to learn on.";
    }
    if (conditions === 'park' || conditions === 'freestyle') {
      return "For park beginners: Get comfortable on groomers first, then look for a true twin with medium flex.";
    }
    // General beginner
    return "For beginners: Prioritize forgiving flex over performance. You can upgrade as you progress.";
  }

  // Intermediate + conditions
  if (skillLevel === 'intermediate') {
    if (conditions === 'icy') {
      return "For intermediate on ice: Hybrid or traditional camber gives you the edge hold you need for confident carving.";
    }
    if (conditions === 'powder') {
      return "For intermediate powder riding: Consider a directional board with some setback for better float.";
    }
    if (conditions === 'park') {
      return "For park progression: True twin shape and medium flex let you develop switch riding and tricks.";
    }
  }

  // Advanced + conditions
  if (skillLevel === 'advanced') {
    if (conditions === 'icy') {
      return "For advanced on ice: Stiff flex and traditional camber maximize edge hold and precision.";
    }
    if (conditions === 'powder') {
      return "For advanced powder: Directional with taper and rocker—consider volume-shifted for maneuverability.";
    }
  }

  return null;
}

/**
 * Get attribute explanations for product specs
 */
export function explainAttribute(attribute: string, value: string, skillLevel?: string): string | null {
  const ATTRIBUTE_KNOWLEDGE: Record<string, Record<string, any>> = {
    flex: {
      soft: {
        description: "Forgiving and playful",
        beginner: "Perfect for learning—won't punish mistakes",
        intermediate: "Great for park and buttering",
        advanced: "Too soft for aggressive riding"
      },
      medium: {
        description: "Balanced and versatile",
        beginner: "Good for progression",
        intermediate: "All-around performance",
        advanced: "Versatile daily driver"
      },
      stiff: {
        description: "Responsive and powerful",
        beginner: "Too demanding for learning",
        intermediate: "For confident riders",
        advanced: "Precision carving and speed"
      }
    },
    camber: {
      traditional: {
        description: "Classic arc with edge contact at tip/tail",
        benefit: "Maximum pop and edge hold",
        drawback: "Can be catchy for beginners"
      },
      rocker: {
        description: "Reverse camber, contact in middle",
        benefit: "Super forgiving, great in powder",
        drawback: "Less edge hold on hard pack"
      },
      hybrid: {
        description: "Combination of camber and rocker zones",
        benefit: "Best of both worlds—versatile",
        use_case: "All-mountain riding"
      }
    },
    shape: {
      twin: {
        description: "Symmetrical nose and tail",
        benefit: "Ride switch easily",
        best_for: "Park and freestyle"
      },
      directional: {
        description: "Longer nose, shorter tail",
        benefit: "Better float and stability",
        best_for: "All-mountain and powder"
      }
    }
  };

  const knowledge = ATTRIBUTE_KNOWLEDGE[attribute.toLowerCase()]?.[value.toLowerCase()];
  if (!knowledge) return null;

  // Return skill-level specific guidance if available
  if (skillLevel && knowledge[skillLevel]) {
    return knowledge[skillLevel];
  }

  // Return description + benefit
  return `${knowledge.description}${knowledge.benefit ? `. ${knowledge.benefit}` : ''}`;
}
