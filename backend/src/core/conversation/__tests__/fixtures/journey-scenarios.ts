/**
 * Realistic Multi-Turn Journey Fixtures
 *
 * These scenarios capture full concierge arcs with:
 * - Natural language (multi-clause, context-rich, typos, slang)
 * - Complete flows: rapport → diagnosis → clarifiers → curated picks → closing
 * - Real constraints: budget, timing, lifestyle, emotion
 * - Cross-vertical diversity: sports, fashion, electronics, home
 */

export interface JourneyTurn {
  role: 'user' | 'assistant';
  message: string;
  expectedBehavior?: {
    topic?: string;
    mode?: string;
    maxProducts?: number;
    hasClarifier?: boolean;
    hasOptions?: boolean;
    minWordCount?: number;
    mustContain?: string[];
    mustNotContain?: string[];
  };
}

export interface JourneyScenario {
  id: string;
  name: string;
  vertical: 'sports' | 'fashion' | 'electronics' | 'home' | 'lifestyle';
  description: string;
  turns: JourneyTurn[];
  expectedOutcomes: {
    totalClarifiers: number;  // Minimum clarifying questions asked
    finalProductCount: number;  // ≤3 for concierge
    userConstraintsAcknowledged: string[];  // Budget, timing, etc.
    spinStagesCompleted: ('situation' | 'problem' | 'implication' | 'need_payoff')[];
  };
}

/**
 * JOURNEY 1: Snowboard Fit (Sports Vertical)
 * Complex multi-attribute search with lifestyle context
 */
export const snowboardJourney: JourneyScenario = {
  id: 'journey-snowboard-whistler',
  name: 'Whistler Trip - Intermediate Snowboard',
  vertical: 'sports',
  description: 'Real shopper with trip deadline, skill level, terrain mix, budget, and past experience',
  turns: [
    {
      role: 'user',
      message: 'Hey there, Im heading to Whistler in February and need a snowboard that wont punish an intermediate rider. any suggestions?',
      expectedBehavior: {
        topic: 'commerce',
        mode: 'clarify',
        hasClarifier: true,
        maxProducts: 0,  // Should ask before showing
        minWordCount: 20,
        mustContain: ['you', 'Whistler', 'intermediate'],
        mustNotContain: ['17 products', 'all snowboards']
      }
    },
    {
      role: 'assistant',
      message: 'Happy to help you find the right board for Whistler! To narrow down the perfect match, what type of terrain will you be riding most—groomers, tree runs, or powder bowls?',
    },
    {
      role: 'user',
      message: 'Mostly groomers during the day but id love something that can handle a surprise powder dump lol',
      expectedBehavior: {
        mode: 'clarify',
        hasClarifier: true,
        maxProducts: 2,  // Might show 1-2 preview cards
        minWordCount: 20,
        mustContain: ['you', 'groomer', 'powder'],
      }
    },
    {
      role: 'assistant',
      message: 'Perfect—so an all-mountain board with powder capability. To dial in the flex and shape, what\'s your current board or anything you\'ve liked/disliked?',
    },
    {
      role: 'user',
      message: 'im on a Burton Custom from like 2015, its a bit stiff and catchy when my legs get tired by end of day',
      expectedBehavior: {
        mode: 'clarify',
        hasClarifier: true,
        minWordCount: 20,
        mustContain: ['you', 'Burton', 'flex'],
      }
    },
    {
      role: 'assistant',
      message: 'Got it—sounds like you want something more forgiving than the Custom. What\'s your budget roughly, and do you need the board in hand before your trip?',
    },
    {
      role: 'user',
      message: 'Under $600 would be ideal and I leave in 3 weeks so need it soon',
      expectedBehavior: {
        mode: 'recommend',
        maxProducts: 3,  // FINAL CURATION
        minWordCount: 30,
        mustContain: ['you', 'forgiving', '$600', 'ship'],
        mustNotContain: ['17', 'all boards', 'everything']
      }
    },
    {
      role: 'assistant',
      message: 'Perfect—here are three forgiving all-mountain boards under $600 with 2-day shipping. Each one has a softer flex than your Custom and floats in powder. Let me know which feels closest to what you want.',
    },
    {
      role: 'user',
      message: 'can you tell me why option 2 is best for me?',
      expectedBehavior: {
        mode: 'chat',
        maxProducts: 1,
        minWordCount: 40,
        mustContain: ['you', 'because', 'groomer', 'powder', 'forgiving'],
      }
    }
  ],
  expectedOutcomes: {
    totalClarifiers: 3,  // Asked about terrain, experience, budget/timing
    finalProductCount: 3,
    userConstraintsAcknowledged: ['under $600', '3 weeks', 'intermediate', 'groomers', 'powder', 'forgiving flex'],
    spinStagesCompleted: ['situation', 'problem', 'implication', 'need_payoff']
  }
};

/**
 * JOURNEY 2: Capsule Wardrobe (Fashion Vertical)
 */
export const wardrobeJourney: JourneyScenario = {
  id: 'journey-wardrobe-promotion',
  name: 'Work Wardrobe Refresh Post-Promotion',
  vertical: 'fashion',
  description: 'Career milestone shopping with style constraints, existing pieces, fabric preferences',
  turns: [
    {
      role: 'user',
      message: 'Hi! I just got promoted to VP and need help refreshing my work wardrobe... feeling like i wear the same 3 outfits every week lol',
      expectedBehavior: {
        topic: 'commerce',
        mode: 'clarify',
        hasClarifier: true,
        maxProducts: 0,
        minWordCount: 20,
        mustContain: ['congratulations', 'you', 'work', 'style'],
      }
    },
    {
      role: 'assistant',
      message: 'Congratulations on the VP role! Let\'s build you a wardrobe you\'re excited about. What\'s the vibe at your office—sharp tailored suits, smart casual, or somewhere in between?',
    },
    {
      role: 'user',
      message: 'smart casual but polished since i meet clients a lot. need to look put together but not stuffy',
      expectedBehavior: {
        mode: 'clarify',
        hasClarifier: true,
        minWordCount: 20,
        mustContain: ['you', 'smart casual', 'client'],
      }
    },
    {
      role: 'assistant',
      message: 'Perfect—polished but approachable. Which current pieces make you feel most confident so I can build around them?',
    },
    {
      role: 'user',
      message: 'my navy blazer and slim grey trousers are solid but my tops feel really dated',
      expectedBehavior: {
        mode: 'clarify',
        hasClarifier: true,
        minWordCount: 20,
        mustContain: ['you', 'blazer', 'trouser', 'top'],
      }
    },
    {
      role: 'assistant',
      message: 'Great foundation. Are there colors or fabrics you gravitate toward—or ones you want to avoid?',
    },
    {
      role: 'user',
      message: 'love jewel tones and breathable fabrics, no polyester if possible bc it makes me sweat during presentations',
      expectedBehavior: {
        mode: 'clarify',
        hasClarifier: true,
        minWordCount: 20,
        mustContain: ['you', 'jewel', 'breathable'],
      }
    },
    {
      role: 'assistant',
      message: 'Noted—jewel tones in natural fabrics. Any budget guardrails or must-have items for the next few weeks?',
    },
    {
      role: 'user',
      message: 'can spend like $800 now and need 2 presentation-worthy outfits ready to go',
      expectedBehavior: {
        mode: 'recommend',
        maxProducts: 3,
        minWordCount: 40,
        mustContain: ['you', '$800', 'presentation', 'natural', 'jewel'],
        mustNotContain: ['polyester']
      }
    }
  ],
  expectedOutcomes: {
    totalClarifiers: 4,
    finalProductCount: 3,
    userConstraintsAcknowledged: ['$800', 'smart casual', 'jewel tones', 'natural fabrics', 'no polyester', 'presentation-worthy'],
    spinStagesCompleted: ['situation', 'problem', 'need_payoff']
  }
};

/**
 * JOURNEY 3: Creative Laptop (Electronics Vertical)
 */
export const laptopJourney: JourneyScenario = {
  id: 'journey-laptop-designer',
  name: 'Mobile Video Editing Laptop',
  vertical: 'electronics',
  description: 'Technical specs + lifestyle constraints (portability, battery, delivery)',
  turns: [
    {
      role: 'user',
      message: 'hello, im a freelance designer and need a laptop that can edit 4K video without lag since my current macbook is dying',
      expectedBehavior: {
        topic: 'commerce',
        mode: 'clarify',
        hasClarifier: true,
        minWordCount: 20,
        mustContain: ['you', '4K', 'video', 'edit'],
      }
    },
    {
      role: 'assistant',
      message: 'Happy to help you find the right machine. Do you mostly work plugged in at a studio desk, or do you edit on the go?',
    },
    {
      role: 'user',
      message: 'i move between coffee shops and client offices so weight and battery life really matter',
      expectedBehavior: {
        mode: 'clarify',
        hasClarifier: true,
        minWordCount: 20,
        mustContain: ['you', 'portable', 'battery'],
      }
    },
    {
      role: 'assistant',
      message: 'Makes sense—portability is key. Which creative apps are mission-critical: Premiere, DaVinci, After Effects, Blender?',
    },
    {
      role: 'user',
      message: 'Premiere and After Effects daily, some Lightroom batches too',
      expectedBehavior: {
        mode: 'clarify',
        hasClarifier: true,
        minWordCount: 20,
        mustContain: ['you', 'Premiere', 'After Effects'],
      }
    },
    {
      role: 'assistant',
      message: 'Got it. Any ecosystem preferences like macOS versus Windows, or ports you absolutely need?',
    },
    {
      role: 'user',
      message: 'prefer macOS, need at least 2 Thunderbolt ports and SD slot would be clutch',
      expectedBehavior: {
        mode: 'clarify',
        hasClarifier: true,
        minWordCount: 20,
        mustContain: ['you', 'macOS', 'Thunderbolt'],
      }
    },
    {
      role: 'assistant',
      message: 'Perfect. What\'s your budget ceiling, and do you need it delivered by a specific date?',
    },
    {
      role: 'user',
      message: 'top end $2500 and need it within a week for a project kickoff',
      expectedBehavior: {
        mode: 'recommend',
        maxProducts: 3,
        minWordCount: 40,
        mustContain: ['you', '$2500', 'macOS', 'Premiere', 'ship', 'Thunderbolt'],
      }
    }
  ],
  expectedOutcomes: {
    totalClarifiers: 4,
    finalProductCount: 3,
    userConstraintsAcknowledged: ['$2500', 'macOS', 'portable', 'Premiere', 'After Effects', 'Thunderbolt', '1 week delivery'],
    spinStagesCompleted: ['situation', 'problem', 'need_payoff']
  }
};

/**
 * JOURNEY 4: Living Room Makeover (Home Vertical)
 */
export const livingRoomJourney: JourneyScenario = {
  id: 'journey-living-room-hosting',
  name: 'Living Room Pre-Hosting Refresh',
  vertical: 'home',
  description: 'Multi-item bundle with event deadline, style preferences, existing pieces',
  turns: [
    {
      role: 'user',
      message: 'Hi concierge! want to make my living room more welcoming before my in-laws visit next month... its kinda bland rn',
      expectedBehavior: {
        topic: 'commerce',
        mode: 'clarify',
        hasClarifier: true,
        minWordCount: 20,
        mustContain: ['you', 'living room', 'welcoming'],
      }
    },
    {
      role: 'assistant',
      message: 'I\'d love to help make your space feel welcoming. How do you currently use it—family movie nights, hosting guests, quiet reading?',
    },
    {
      role: 'user',
      message: 'mostly family evenings with the kids but want it to feel impressive when we host',
      expectedBehavior: {
        mode: 'clarify',
        hasClarifier: true,
        minWordCount: 20,
        mustContain: ['you', 'family', 'host'],
      }
    },
    {
      role: 'assistant',
      message: 'Perfect—functional for daily life but elevated for guests. What pieces are staying put, and which are you open to replacing?',
    },
    {
      role: 'user',
      message: 'keeping the grey sectional, everything else can go. current coffee table is super scratched',
      expectedBehavior: {
        mode: 'clarify',
        hasClarifier: true,
        minWordCount: 20,
        mustContain: ['you', 'sectional', 'coffee table'],
      }
    },
    {
      role: 'assistant',
      message: 'Great foundation. Describe the style you\'re aiming for—warm modern, coastal, classic?',
    },
    {
      role: 'user',
      message: 'warm modern with a touch of brass accents, nothing too formal or stuffy',
      expectedBehavior: {
        mode: 'clarify',
        hasClarifier: true,
        minWordCount: 20,
        mustContain: ['you', 'warm modern', 'brass'],
      }
    },
    {
      role: 'assistant',
      message: 'Love it. Budget-wise, are you focused on one hero piece or a full room refresh?',
    },
    {
      role: 'user',
      message: 'ok spending around $1200 as long as we cover lighting coffee table and some decor accents',
      expectedBehavior: {
        mode: 'recommend',
        maxProducts: 3,
        minWordCount: 40,
        mustContain: ['you', '$1200', 'lighting', 'coffee table', 'warm modern', 'brass'],
      }
    }
  ],
  expectedOutcomes: {
    totalClarifiers: 4,
    finalProductCount: 3,
    userConstraintsAcknowledged: ['$1200', 'next month', 'warm modern', 'brass', 'grey sectional', 'family-friendly', 'impressive hosting'],
    spinStagesCompleted: ['situation', 'problem', 'need_payoff']
  }
};

/**
 * SINGLE-TURN COMPLEX PROMPTS
 * Realistic one-shot queries with nested constraints
 */
export const singleTurnPrompts: Array<{
  id: string;
  message: string;
  vertical: string;
  expectedBehavior: {
    mode: string;
    maxProducts: number;
    minClarifiers: number;
    mustAcknowledge: string[];
  };
}> = [
  {
    id: 'wedding-maternity-dress',
    message: 'Im shopping for a wedding guest dress that works for a June garden ceremony and hides my baby bump without being too obvious about it',
    vertical: 'fashion',
    expectedBehavior: {
      mode: 'clarify',
      maxProducts: 0,
      minClarifiers: 1,
      mustAcknowledge: ['June', 'garden', 'baby bump', 'wedding guest']
    }
  },
  {
    id: 'teen-skateboard-safety',
    message: 'My teenager just started skateboarding and I want to get protective gear that theyll actually wear and not leave in their locker',
    vertical: 'sports',
    expectedBehavior: {
      mode: 'clarify',
      maxProducts: 0,
      minClarifiers: 1,
      mustAcknowledge: ['teenager', 'protective', 'skateboard', 'wear']
    }
  },
  {
    id: 'swim-smartwatch-professional',
    message: 'Need a smartwatch that tracks open-water swims but also looks professional enough for client meetings, not super sporty',
    vertical: 'electronics',
    expectedBehavior: {
      mode: 'clarify',
      maxProducts: 0,
      minClarifiers: 1,
      mustAcknowledge: ['open-water', 'swim', 'professional', 'client']
    }
  },
  {
    id: 'espresso-small-counter',
    message: 'Budgets around $350—can we build a starter espresso setup that actually fits on a 24-inch counter? my kitchen is tiny',
    vertical: 'home',
    expectedBehavior: {
      mode: 'clarify',
      maxProducts: 2,
      minClarifiers: 1,
      mustAcknowledge: ['$350', '24-inch', 'espresso', 'small']
    }
  },
  {
    id: 'anniversary-sustainable-jewelry',
    message: 'stuck choosing a third anniversary gift... she loves sustainable jewelry and art books but idk how to narrow it down',
    vertical: 'lifestyle',
    expectedBehavior: {
      mode: 'clarify',
      maxProducts: 0,
      minClarifiers: 2,
      mustAcknowledge: ['anniversary', 'sustainable', 'jewelry', 'art books']
    }
  },
  {
    id: 'hiking-rain-city-boots',
    message: 'Do you have hiking boots that stay dry in Irish rain but dont feel heavy when I walk around Dublin for the rest of the trip?',
    vertical: 'sports',
    expectedBehavior: {
      mode: 'clarify',
      maxProducts: 2,
      minClarifiers: 1,
      mustAcknowledge: ['hiking', 'rain', 'waterproof', 'lightweight', 'city']
    }
  },
  {
    id: 'sofa-comparison-durability',
    message: 'Can you compare two sofas for me if I send the links? I want whichever holds up best to kids dogs and spilled juice',
    vertical: 'home',
    expectedBehavior: {
      mode: 'compare',
      maxProducts: 2,
      minClarifiers: 0,
      mustAcknowledge: ['compare', 'kids', 'dogs', 'durability']
    }
  },
  {
    id: 'carryon-strict-airlines',
    message: 'I need a carry-on roller that fits strict European budget airlines and has an easy laptop pocket for security',
    vertical: 'lifestyle',
    expectedBehavior: {
      mode: 'clarify',
      maxProducts: 2,
      minClarifiers: 1,
      mustAcknowledge: ['carry-on', 'European', 'airline', 'laptop']
    }
  }
];

/**
 * GEMINI DRIFT GUARDRAIL TESTS
 * Prompts designed to trigger off-topic responses
 */
export const driftGuardrailTests: Array<{
  id: string;
  userMessage: string;
  geminiMockResponse: string;
  expectedBehavior: {
    shouldReject: boolean;
    shouldReframe: boolean;
    allowedTopics: string[];
  };
}> = [
  {
    id: 'drift-random-trivia',
    userMessage: 'Random fact of the day?',
    geminiMockResponse: 'According to history.com, the shortest war in history was between Britain and Zanzibar in 1896, lasting only 38 minutes...',
    expectedBehavior: {
      shouldReject: true,
      shouldReframe: true,
      allowedTopics: ['rapport']
    }
  },
  {
    id: 'drift-wikipedia-response',
    userMessage: 'Tell me about snowboarding',
    geminiMockResponse: 'Snowboarding is a recreational and competitive activity that involves descending a snow-covered slope while standing on a snowboard. According to Wikipedia, it became an Olympic sport in 1998...',
    expectedBehavior: {
      shouldReject: true,
      shouldReframe: false,  // This is product_info, should stay focused
      allowedTopics: ['product_info']
    }
  },
  {
    id: 'drift-chatbot-disclaimer',
    userMessage: 'Can you help me find a snowboard?',
    geminiMockResponse: 'I\'m just a chatbot and can\'t actually purchase items for you, but I can provide information about snowboards...',
    expectedBehavior: {
      shouldReject: true,
      shouldReframe: true,
      allowedTopics: ['commerce']
    }
  },
  {
    id: 'drift-excessive-products',
    userMessage: 'show me snowboards',
    geminiMockResponse: 'Here are 15 snowboards I found: Product 1, Product 2, Product 3...',
    expectedBehavior: {
      shouldReject: true,
      shouldReframe: true,
      allowedTopics: ['commerce']
    }
  },
  {
    id: 'drift-generic-advice',
    userMessage: 'What should I look for in a snowboard?',
    geminiMockResponse: 'When buying a snowboard, consider factors like your skill level, riding style, and budget. It\'s important to do your research and read reviews...',
    expectedBehavior: {
      shouldReject: false,  // This is acceptable product_info
      shouldReframe: false,
      allowedTopics: ['product_info', 'commerce']
    }
  }
];
