export type ProductAttribute = {
  name: string;
  value: string;
  weight?: number;
};

export type ProductContext = {
  id: string;
  shopifyProductId: number;
  title: string;
  handle: string;
  description: string;
  price: number | null;
  currency?: string;
  imageUrl?: string;
  tags: string[];
  productType?: string;
  vendor?: string;
  inventoryStatus?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder';
  attributes: ProductAttribute[];
  useCases: string[];
  upsellCandidates: UpsellCandidate[];
  crossSellCandidates: UpsellCandidate[];
  sellingPoints: string[];
  objections?: string[];
};

export type UpsellCandidate = {
  productId: string;
  reason: string;
  discountText?: string;
  probability?: number;
};

export type ProductRetrievalResult = {
  products: ProductContext[];
  source: 'semantic' | 'keyword' | 'manual';
  explanation?: string;
};
