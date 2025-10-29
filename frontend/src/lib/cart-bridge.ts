/**
 * Cart Bridge Interface
 *
 * Abstracts cart operations so we can swap implementations:
 * - MockCart (for standalone testing)
 * - ShopifyAjaxCart (for Shopify embedded)
 * - WooCommerceCart (for white-label)
 */

export interface CartItem {
  variantId: string;
  quantity: number;
  properties?: Record<string, string>; // Shopify cart attributes
}

export interface CartBridge {
  /**
   * Add item to cart
   * @returns Promise<boolean> - true if successful
   */
  addItem(item: CartItem): Promise<boolean>;

  /**
   * Get current cart state
   */
  getCart(): Promise<Cart | null>;

  /**
   * Update item quantity
   */
  updateItem(variantId: string, quantity: number): Promise<boolean>;

  /**
   * Remove item from cart
   */
  removeItem(variantId: string): Promise<boolean>;

  /**
   * Navigate to checkout
   */
  goToCheckout(): void;
}

export interface Cart {
  items: CartItem[];
  total: number;
  currency: string;
  itemCount: number;
}

/**
 * Mock implementation for standalone testing
 */
export class MockCart implements CartBridge {
  private items: CartItem[] = [];

  async addItem(item: CartItem): Promise<boolean> {
    console.log('[MockCart] Adding item:', item);
    this.items.push(item);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Show success toast
    if (typeof window !== 'undefined') {
      // You'd use your toast library here
      console.log('✅ Added to cart');
    }

    return true;
  }

  async getCart(): Promise<Cart> {
    return {
      items: this.items,
      total: 0, // Calculate from items
      currency: 'USD',
      itemCount: this.items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  async updateItem(variantId: string, quantity: number): Promise<boolean> {
    const item = this.items.find(i => i.variantId === variantId);
    if (item) {
      item.quantity = quantity;
      return true;
    }
    return false;
  }

  async removeItem(variantId: string): Promise<boolean> {
    this.items = this.items.filter(i => i.variantId !== variantId);
    return true;
  }

  goToCheckout(): void {
    console.log('[MockCart] Checkout clicked. Items:', this.items);
    alert('Mock checkout - cart has ' + this.items.length + ' items');
  }
}

/**
 * Shopify Ajax Cart implementation
 * Uses Shopify's Cart API: https://shopify.dev/docs/api/ajax/reference/cart
 */
export class ShopifyAjaxCart implements CartBridge {
  async addItem(item: CartItem): Promise<boolean> {
    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.variantId,
          quantity: item.quantity,
          properties: item.properties,
        }),
      });

      if (!response.ok) throw new Error('Failed to add to cart');

      // Trigger Shopify cart drawer (if theme supports it)
      if (typeof window !== 'undefined' && (window as any).Shopify?.theme?.cart) {
        (window as any).Shopify.theme.cart.open();
      }

      return true;
    } catch (error) {
      console.error('[ShopifyAjaxCart] Add failed:', error);
      return false;
    }
  }

  async getCart(): Promise<Cart | null> {
    try {
      const response = await fetch('/cart.js');
      if (!response.ok) throw new Error('Failed to fetch cart');

      const data = await response.json();

      return {
        items: data.items.map((item: any) => ({
          variantId: item.variant_id.toString(),
          quantity: item.quantity,
          properties: item.properties,
        })),
        total: data.total_price / 100, // Shopify returns cents
        currency: data.currency,
        itemCount: data.item_count,
      };
    } catch (error) {
      console.error('[ShopifyAjaxCart] Get cart failed:', error);
      return null;
    }
  }

  async updateItem(variantId: string, quantity: number): Promise<boolean> {
    try {
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: variantId,
          quantity,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('[ShopifyAjaxCart] Update failed:', error);
      return false;
    }
  }

  async removeItem(variantId: string): Promise<boolean> {
    return this.updateItem(variantId, 0);
  }

  goToCheckout(): void {
    window.location.href = '/checkout';
  }
}

/**
 * Factory to get the appropriate cart implementation
 */
export function getCartBridge(): CartBridge {
  // Detect environment
  if (typeof window === 'undefined') {
    // Server-side rendering
    return new MockCart();
  }

  // Check if we're in Shopify environment
  const isShopify =
    window.location.hostname.includes('myshopify.com') ||
    (window as any).Shopify !== undefined;

  if (isShopify) {
    return new ShopifyAjaxCart();
  }

  // Default to mock for standalone/development
  return new MockCart();
}
