export interface ProductVariant {
  id?: string;
  title?: string | null;
  price?: number | null;
  compare_at_price?: number | null;
  sku?: string | null;
  option_values?: string[];
  inventory_quantity?: number | null;
  available?: boolean | null;
}

import type { ProductSummary } from '../product-intelligence/summary-schema';

export interface Product {
  id: string;
  title: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  image_url?: string | null;
  handle: string;
  vendor?: string | null;
  product_type?: string | null;
  tags?: string[];
  combined_score?: number | null;
  variants?: ProductVariant[];
  summary?: ProductSummary | null;
}
