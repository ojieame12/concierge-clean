import { useState, useCallback } from 'react';
import { getCartBridge, type CartItem, type Cart } from '@/lib/cart-bridge';

const cart = getCartBridge();

export function useCart() {
  const [isAdding, setIsAdding] = useState(false);
  const [cartData, setCartData] = useState<Cart | null>(null);

  const addToCart = useCallback(async (variantId: string, quantity: number = 1) => {
    setIsAdding(true);

    const success = await cart.addItem({ variantId, quantity });

    if (success) {
      // Refresh cart state
      const updated = await cart.getCart();
      setCartData(updated);
    }

    setIsAdding(false);
    return success;
  }, []);

  const refreshCart = useCallback(async () => {
    const data = await cart.getCart();
    setCartData(data);
  }, []);

  const goToCheckout = useCallback(() => {
    cart.goToCheckout();
  }, []);

  return {
    addToCart,
    refreshCart,
    goToCheckout,
    isAdding,
    cart: cartData,
  };
}
