export type BrandVoice = {
  toneKeywords: string[];
  samplePhrases: string[];
  persona: string;
  dos: string[];
  donts: string[];
};

export type BrandPolicies = {
  shipping: string;
  returns: string;
  guarantees?: string;
  freeShippingThreshold?: number;
  paymentOptions?: string[];
  loyaltyProgram?: string;
  escalationInstructions?: string;
};

export type MerchandisingPriorities = {
  highMarginSkus?: string[];
  seasonalCampaigns?: string[];
  promotionCopy?: string;
  bundles?: Array<{
    title: string;
    productIds: string[];
    benefit: string;
  }>;
};

export type BrandProfile = {
  brandName: string;
  mission: string;
  voice: BrandVoice;
  policies: BrandPolicies;
  merchandising: MerchandisingPriorities;
  vertical: string;
  productHighlights: string[];
  onboardingPrompts?: string[];
};

export type ThemeConfig = {
  palette: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
  };
};

export type ThemeResponse = {
  theme: ThemeConfig;
  brandProfile: BrandProfile;
  source: 'fallback' | 'synced' | 'cache';
};
