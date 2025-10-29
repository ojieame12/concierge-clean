/**
 * Product Test Fixtures
 */

export const mockProducts = [
  {
    id: 'prod-1',
    title: 'Beginner Snowboard - All Mountain',
    price: 299.99,
    vendor: 'Burton',
    brand: 'Burton',
    category_path: ['Sports', 'Winter Sports', 'Snowboarding'],
    rating: 4.5,
    review_count: 120,
    similarity: 0.95,
    combined_score: 0.95,
    attributes: {
      skill_level: 'beginner',
      style: 'all_mountain',
      flex: 'soft',
    },
    tags: ['beginner-friendly', 'versatile', 'forgiving'],
    variants: [
      { id: 'var-1', title: '150cm', price: 299.99, available: true },
      { id: 'var-2', title: '155cm', price: 299.99, available: true },
    ],
  },
  {
    id: 'prod-2',
    title: 'Advanced Snowboard - Freestyle',
    price: 499.99,
    vendor: 'Lib Tech',
    brand: 'Lib Tech',
    category_path: ['Sports', 'Winter Sports', 'Snowboarding'],
    rating: 4.8,
    review_count: 85,
    similarity: 0.88,
    combined_score: 0.88,
    attributes: {
      skill_level: 'advanced',
      style: 'freestyle',
      flex: 'medium',
    },
    tags: ['park', 'tricks', 'responsive'],
    variants: [
      { id: 'var-3', title: '152cm', price: 499.99, available: true },
    ],
  },
  {
    id: 'prod-3',
    title: 'Intermediate Snowboard - All Mountain',
    price: 399.99,
    vendor: 'Burton',
    brand: 'Burton',
    category_path: ['Sports', 'Winter Sports', 'Snowboarding'],
    rating: 4.6,
    review_count: 200,
    similarity: 0.92,
    combined_score: 0.92,
    attributes: {
      skill_level: 'intermediate',
      style: 'all_mountain',
      flex: 'medium',
    },
    tags: ['versatile', 'progression', 'reliable'],
    variants: [
      { id: 'var-4', title: '155cm', price: 399.99, available: true },
      { id: 'var-5', title: '160cm', price: 399.99, available: false },
    ],
  },
  {
    id: 'prod-4',
    title: 'Budget Snowboard - Beginner',
    price: 199.99,
    vendor: 'Generic Brand',
    brand: 'Generic Brand',
    category_path: ['Sports', 'Winter Sports', 'Snowboarding'],
    rating: 3.8,
    review_count: 45,
    similarity: 0.85,
    combined_score: 0.85,
    attributes: {
      skill_level: 'beginner',
      style: 'all_mountain',
      flex: 'soft',
    },
    tags: ['budget', 'entry-level'],
    variants: [
      { id: 'var-6', title: '150cm', price: 199.99, available: true },
    ],
  },
  {
    id: 'prod-5',
    title: 'Premium Snowboard - Expert Freeride',
    price: 699.99,
    vendor: 'Jones',
    brand: 'Jones',
    category_path: ['Sports', 'Winter Sports', 'Snowboarding'],
    rating: 4.9,
    review_count: 150,
    similarity: 0.80,
    combined_score: 0.80,
    attributes: {
      skill_level: 'expert',
      style: 'freeride',
      flex: 'stiff',
    },
    tags: ['backcountry', 'powder', 'high-performance'],
    variants: [
      { id: 'var-7', title: '158cm', price: 699.99, available: true },
      { id: 'var-8', title: '162cm', price: 699.99, available: true },
    ],
  },
];

export const mockProductsWithMissingPrice = [
  {
    id: 'prod-missing-1',
    title: 'Product Without Price',
    // price: missing
    vendor: 'Test Vendor',
    variants: [
      { id: 'var-9', title: 'Variant 1', price: 99.99, available: true },
    ],
  },
  {
    id: 'prod-missing-2',
    title: 'Product Without Price or Variants',
    // price: missing
    // variants: missing
    vendor: 'Test Vendor',
  },
];

export const mockRunningShoes = [
  {
    id: 'shoe-1',
    title: 'Nike Air Zoom Pegasus 40',
    price: 129.99,
    vendor: 'Nike',
    brand: 'Nike',
    category_path: ['Shoes', 'Running Shoes', 'Road Running'],
    rating: 4.7,
    review_count: 350,
    similarity: 0.93,
    combined_score: 0.93,
    attributes: {
      type: 'road',
      cushioning: 'medium',
      support: 'neutral',
    },
  },
  {
    id: 'shoe-2',
    title: 'Adidas Ultraboost 23',
    price: 189.99,
    vendor: 'Adidas',
    brand: 'Adidas',
    category_path: ['Shoes', 'Running Shoes', 'Road Running'],
    rating: 4.8,
    review_count: 420,
    similarity: 0.91,
    combined_score: 0.91,
    attributes: {
      type: 'road',
      cushioning: 'high',
      support: 'neutral',
    },
  },
  {
    id: 'shoe-3',
    title: 'Brooks Ghost 15',
    price: 139.99,
    vendor: 'Brooks',
    brand: 'Brooks',
    category_path: ['Shoes', 'Running Shoes', 'Road Running'],
    rating: 4.6,
    review_count: 280,
    similarity: 0.89,
    combined_score: 0.89,
    attributes: {
      type: 'road',
      cushioning: 'medium',
      support: 'neutral',
    },
  },
];
