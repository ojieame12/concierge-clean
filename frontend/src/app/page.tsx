'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { LayoutGroup, motion } from 'framer-motion';
import { BigIntro } from '@/components/intro/BigIntro';
import { MainInput } from '@/components/conversation/MainInput';
import { UserMessage } from '@/components/conversation/UserMessage';
import { ResponseTurn } from '@/components/conversation/ResponseTurn';
import { SomethingElseInput } from '@/components/conversation/SomethingElseInput';
import { ProductDrawer } from '@/components/products/ProductDrawer';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { DottedSurface } from '@/components/ui/dotted-surface';
import { useTimelineConversation } from '@/hooks/useTimelineConversation';
import { useCart } from '@/hooks/useCart';
import { extractResponseStructure } from '@/types/response';
import type { TimelineEntry, AssistantResponse } from '@/types/timeline';
import type { ProductCard as ProductCardType, FactSheet } from '@/types';
import type { ConversationMetadata } from '@/types/conversation';
import { ArrowUp, ShoppingBag } from 'lucide-react';

const SHOP_DOMAIN = process.env.NEXT_PUBLIC_JOURNEY_SHOP ?? 'insite-intellgience.myshopify.com';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

type StoreProfile = {
  name?: string | null;
  primaryCategory?: string | null;
  topBrands?: string[];
  samplePrompts?: string[];
  greeting?: string | null;
};

export default function JourneyV2Page() {
  const {
    timeline,
    isLoading,
    error,
    metadata,
    manualClarifierActive,
    sendMessage,
    selectOption,
    recordSystemEvent,
    dismissManualClarifier,
  } = useTimelineConversation({ shop: SHOP_DOMAIN, apiUrl: API_URL });

  const { addToCart, cart } = useCart();

  const [inputValue, setInputValue] = useState('');
  const [drawerProduct, setDrawerProduct] = useState<DrawerProduct | null>(null);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [cartAnimationKey, setCartAnimationKey] = useState(0);
  const [comparisonState, setComparisonState] = useState<{ responseId: string | null; selected: string[] }>({ responseId: null, selected: [] });
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const threadContainerRef = useRef<HTMLDivElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const activeTurnRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const userInteractingRef = useRef(false);
  const userInteractionTimeout = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);
  const isScrollingUpRef = useRef(false);

  const cartCount = cart?.itemCount ?? 0;

  useEffect(() => {
    const lastComparison = [...timeline]
      .reverse()
      .find((entry): entry is { type: 'assistant'; response: AssistantResponse } =>
        entry.type === 'assistant'
        && (entry.response.metadata?.layoutHints?.mode === 'comparison'
          || (entry.response.metadata as any)?.mode === 'comparison')
      );

    if (!lastComparison) {
      setComparisonState((prev) => (prev.responseId ? { responseId: null, selected: [] } : prev));
      return;
    }

    setComparisonState((prev) => {
      if (prev.responseId === lastComparison.response.id) {
        return prev;
      }

      const seeds = lastComparison.response.metadata?.layoutHints?.highlight_products
        ?? (lastComparison.response.metadata as any)?.highlight_products
        ?? [];

      return {
        responseId: lastComparison.response.id,
        selected: Array.isArray(seeds) ? seeds.slice(0, 2) : [],
      };
    });
  }, [timeline]);

  useEffect(() => {
    if (cartCount > 0) {
      setCartAnimationKey((key) => key + 1);
    }
  }, [cartCount]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/theme?shop=${encodeURIComponent(SHOP_DOMAIN)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        try {
          return await response.json();
        } catch (error) {
          console.warn('[journeyv2] failed to parse theme response', error);
          return null;
        }
      })
      .then((data) => {
        if (!data?.brandProfile) return;
        const profile = data.brandProfile;
        setStoreProfile({
          name: profile.brand_name ?? profile.brandName ?? null,
          primaryCategory: profile.primary_category ?? null,
          topBrands: Array.isArray(profile.top_brands) ? profile.top_brands : [],
          samplePrompts: Array.isArray(profile.sample_prompts) ? profile.sample_prompts : undefined,
          greeting: profile.brand_greeting ?? profile.greeting ?? null,
        });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.warn('[journeyv2] failed to load store profile', error);
        }
      });

    return () => controller.abort();
  }, []);

  const introGreeting = useMemo(() => {
    if (storeProfile?.name) {
      return 'Welcome to';
    }
    return storeProfile?.greeting ?? 'Welcome';
  }, [storeProfile]);

  const introDescription = useMemo(() => {
    if (storeProfile?.primaryCategory) {
      return `Tell me what you're looking for in ${storeProfile.primaryCategory}—style, budget, or occasion—and I'll curate a shortlist for you.`;
    }
    return "Share what you're shopping for—budget, style, brand, or occasion—and I'll curate a tailored shortlist for you.";
  }, [storeProfile]);

  const samplePrompts = useMemo(() => {
    const prompts = storeProfile?.samplePrompts ?? [];
    if (prompts.length) {
      return prompts.slice(0, 3).map((text, index) => ({ id: `prompt-${index}`, text }));
    }

    const primary = storeProfile?.primaryCategory;
    const popularPrompt = primary ? `Show me popular ${primary}` : 'Show me popular picks';
    const budgetPrompt = storeProfile?.topBrands?.length
      ? `Do you carry ${storeProfile.topBrands[0]} options?`
      : 'Help me find something within my budget';

    return [
      { id: 'prompt-default-1', text: popularPrompt },
      { id: 'prompt-default-2', text: "What’s new this week?" },
      { id: 'prompt-default-3', text: budgetPrompt },
    ];
  }, [storeProfile]);

  const inputPlaceholder = useMemo(() => {
    if (storeProfile?.primaryCategory) {
      return `What are you looking for in ${storeProfile.primaryCategory}?`;
    }
    return 'What are you looking for today?';
  }, [storeProfile]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInputValue('');
  }, [inputValue, sendMessage]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const latestIndex = timeline.length - 1;
  const hasTimeline = timeline.length > 0;

  const activeAssistantIndex = useMemo(() => {
    for (let i = timeline.length - 1; i >= 0; i -= 1) {
      if (timeline[i]?.type === 'assistant') {
        return i;
      }
    }
    return -1;
  }, [timeline]);

  const computeOpacity = useCallback((depth: number) => {
    if (depth <= 0) return 1;
    if (depth === 1) return 0.85;
    if (depth === 2) return 0.75;
    if (depth === 3) return 0.7;
    return 0.65;
  }, []);

  const scrollActiveIntoView = useCallback(() => {
    const container = threadContainerRef.current;
    const node = activeTurnRef.current;
    if (!container || !node) return;
    if (userInteractingRef.current) return;

    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }

    node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, []);

  useEffect(() => {
    if (!hasTimeline) return;
    if (activeAssistantIndex < 0) {
      const animation = requestAnimationFrame(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
      return () => cancelAnimationFrame(animation);
    }

    const animation = requestAnimationFrame(scrollActiveIntoView);
    return () => cancelAnimationFrame(animation);
  }, [activeAssistantIndex, hasTimeline, scrollActiveIntoView, timeline.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      scrollActiveIntoView();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [scrollActiveIntoView]);

  useEffect(() => {
    const node = activeTurnRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      scrollActiveIntoView();
    });
    observer.observe(node);
    resizeObserverRef.current = observer;

    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
    };
  }, [activeAssistantIndex, scrollActiveIntoView]);

  useEffect(() => {
    if (!hasTimeline) return undefined;

    const container = threadContainerRef.current;
    if (!container) return undefined;

    const markInteraction = () => {
      userInteractingRef.current = true;
      if (userInteractionTimeout.current) {
        window.clearTimeout(userInteractionTimeout.current);
      }
      userInteractionTimeout.current = window.setTimeout(() => {
        userInteractingRef.current = false;
      }, 900);
    };

    const handleScroll = () => {
      const currentTop = container.scrollTop;
      isScrollingUpRef.current = currentTop < lastScrollTopRef.current;
      lastScrollTopRef.current = currentTop;
    };

    container.addEventListener('wheel', markInteraction, { passive: true });
    container.addEventListener('touchstart', markInteraction, { passive: true });
    container.addEventListener('pointerdown', markInteraction);
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('wheel', markInteraction);
      container.removeEventListener('touchstart', markInteraction);
      container.removeEventListener('pointerdown', markInteraction);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [hasTimeline]);

  useEffect(() => () => {
    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
    if (userInteractionTimeout.current) {
      window.clearTimeout(userInteractionTimeout.current);
      userInteractionTimeout.current = null;
    }
  }, []);

  const handleProductSelect = useCallback(
    (product: ProductCardType, entryMetadata?: ConversationMetadata) => {
      void recordSystemEvent({ type: 'selection_change', data: { productId: product.id } });
      const detail = buildDrawerProduct(product, entryMetadata?.factSheets ?? []);
      setDrawerProduct(detail);
      setDrawerOpen(true);
    },
    [recordSystemEvent]
  );

  const handleAddToCart = useCallback(async (variantOverride?: string | null) => {
    if (!drawerProduct) return;
    const variantId = variantOverride ?? drawerProduct.variantId ?? drawerProduct.variants?.[0]?.id ?? null;
    if (!variantId) {
      console.warn('No variant available for add to cart.', drawerProduct);
      return;
    }

    const success = await addToCart(variantId, 1);
    if (success) {
      void recordSystemEvent({
        type: 'add_to_cart',
        data: { productId: drawerProduct.id, variantId },
      });
      setCartAnimationKey((key) => key + 1);
      await sendMessage(`Add the ${drawerProduct.title} to my cart.`, { suppressBubble: true });
      setDrawerOpen(false);
    }
  }, [addToCart, drawerProduct, recordSystemEvent, sendMessage]);

  const handleCompare = useCallback(async () => {
    if (!drawerProduct) return;
    void recordSystemEvent({ type: 'compare_start', data: { productId: drawerProduct.id } });
    await sendMessage('Compare that with something similar for me.', { suppressBubble: true });
    setDrawerOpen(false);
  }, [drawerProduct, recordSystemEvent, sendMessage]);

  const renderEntry = useCallback((
    entry: TimelineEntry,
    index: number,
    depth: number,
    depthOpacity: number,
    isActiveAssistant: boolean
  ) => {
    if (entry.type === 'user') {
      return (
        <UserMessage
          message={entry.message.message}
          timestamp={entry.message.timestamp}
          userName="You"
          userInitial="Y"
          isLatest={index === latestIndex}
          depth={depth}
          depthOpacity={depthOpacity}
        />
      );
    }

    if (entry.type === 'assistant') {
      const { mainLead, detail, contentSegments } = extractResponseStructure(entry.response.segments);
      const allowQuickReplies = entry.response.metadata?.layoutHints?.show_quick_replies !== false;
      const assistantIndex = timeline
        .slice(0, index + 1)
        .filter((item) => item.type === 'assistant').length;
      const isFirstAssistant = assistantIndex === 1;

      const layoutMode = entry.response.metadata?.layoutHints?.mode ?? (entry.response.metadata as any)?.mode ?? null;
      const isComparisonMode = layoutMode === 'comparison';
      const activeComparisonIds = comparisonState.responseId === entry.response.id ? comparisonState.selected : [];

      const toggleComparisonProduct = (product: ProductCardType) => {
        setComparisonState((prev) => {
          const responseId = entry.response.id;
          if (prev.responseId !== responseId) {
            return { responseId, selected: [product.id] };
          }
          const exists = prev.selected.includes(product.id);
          let nextSelected: string[];
          if (exists) {
            nextSelected = prev.selected.filter((id) => id !== product.id);
            if (!nextSelected.length) {
              nextSelected = [product.id];
            }
          } else {
            nextSelected = prev.selected.length >= 3
              ? [...prev.selected.slice(prev.selected.length - 2), product.id]
              : [...prev.selected, product.id];
          }
          return { responseId, selected: nextSelected };
        });
      };

      const responseContent = (
        <ResponseTurn
          mainLead={mainLead ?? undefined}
          responseDetail={detail ?? undefined}
          segments={contentSegments}
          onSelectOption={(value, label) => selectOption(value, label)}
          onSelectProduct={(product) => handleProductSelect(product, entry.response.metadata)}
          selectedOption={entry.response.selectedOption ?? null}
          selectedOptionLabel={entry.response.selectedOptionLabel ?? null}
          isActive={entry.response.isActive && isActiveAssistant}
          isFirstResponse={isFirstAssistant}
          allowQuickReplies={allowQuickReplies}
          depth={depth}
          depthOpacity={depthOpacity}
          comparisonMode={isComparisonMode}
          comparisonSelections={activeComparisonIds}
          onToggleComparisonProduct={toggleComparisonProduct}
        />
      );

      if (isComparisonMode) {
        const productSegment = entry.response.segments.find((segment) => segment.type === 'products') as
          | { type: 'products'; items: ProductCardType[] }
          | undefined;
        const selectedProducts = productSegment?.items
          ?.filter((product) => activeComparisonIds.includes(product.id)) ?? [];

        const readyToCompare = selectedProducts.length >= 2;

        return (
          <div className="space-y-6">
            {responseContent}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: readyToCompare ? 1 : 0.4, y: 0 }}
              className="flex flex-wrap gap-3 items-center"
            >
              <button
                type="button"
                disabled={!readyToCompare}
                onClick={() => {
                  const comparisonPrompt = selectedProducts
                    .map((product) => product.title)
                    .join(' vs ');
                  const message = comparisonPrompt
                    ? `Compare ${comparisonPrompt}`
                    : 'Compare the selected boards for me.';
                  setComparisonState({ responseId: entry.response.id, selected: activeComparisonIds });
                  sendMessage(message);
                }}
                className={`px-6 py-3 rounded-full text-sm font-medium transition-all
                  ${readyToCompare
                    ? 'bg-brand-primary text-white hover:bg-brand-secondary shadow-lg'
                    : 'bg-surface-elevated text-content-tertiary cursor-not-allowed'
                  }`}
              >
                Compare selected boards
              </button>

              {selectedProducts.length > 0 && (
                <div className="flex gap-2 text-sm text-content-secondary">
                  {selectedProducts.map((product) => (
                    <span
                      key={product.id}
                      className="px-3 py-1 rounded-full bg-surface-elevated border border-border"
                    >
                      {product.title}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        );
      }

      return responseContent;
    }

    if (entry.type === 'system') {
      return (
        <div className="text-sm text-content-tertiary">
          {entry.event.type === 'compare_start' && 'Comparison mode enabled.'}
          {entry.event.type === 'compare_execute' && 'Comparing selected items.'}
          {entry.event.type === 'selection_change' && 'Selection updated.'}
          {entry.event.type === 'add_to_cart' && 'Item added to cart.'}
        </div>
      );
    }

    return null;
  }, [handleProductSelect, latestIndex, selectOption, timeline, comparisonState, sendMessage]);

  return (
    <div className="journey-surface">
      <DottedSurface />
      <div className="journey-ambient">
        <div className="journey-blob journey-blob--top" />
        <div className="journey-blob journey-blob--mid" />
        <div className="journey-blob journey-blob--bottom" />
      </div>

      <LayoutGroup>
      <div className="relative z-10 min-h-screen">
        <div className="fixed top-0 left-0 right-0 z-50 bg-surface-overlay/80 backdrop-blur-xl border-b border-white/20 p-4">
          <div className="max-w-[1200px] mx-auto flex items-center justify-between">
            <Image
              src="/Insite_Logo-full.svg"
              alt="Insite Concierge"
              width={180}
              height={40}
              priority
              className="h-8 w-auto"
            />
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <motion.div
                key={cartAnimationKey}
                initial={{ scale: 0.85, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-elevated border border-border text-sm text-content-primary shadow-sm"
              >
                <ShoppingBag size={16} />
                <span>{cartCount}</span>
              </motion.div>
            </div>
        </div>
      </div>

        <div className="pt-20 pb-32">
          {!hasTimeline && (
            <BigIntro
              greeting={introGreeting}
              userName={storeProfile?.name ?? undefined}
              description={introDescription}
              samplePrompts={samplePrompts}
              onPromptClick={(text) => setInputValue(text)}
            >
              <motion.div layoutId="primary-input">
                <MainInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={handleSend}
                  placeholder={inputPlaceholder}
                />
              </motion.div>
            </BigIntro>
          )}

          {hasTimeline && (
            <div className="max-w-[1000px] mx-auto px-6">
              <div
                ref={threadContainerRef}
                className="relative h-[calc(100vh-220px)] overflow-y-auto snap-y snap-proximity pl-8 pr-3 -ml-8 -mr-3 thread-scroll"
              >
                <div className="flex flex-col gap-12 pb-32 pt-8">
                {timeline.map((entry, index) => {
                  const depth = Math.max(0, timeline.length - 1 - index);
                  const isActiveAssistant = index === activeAssistantIndex;
                  const baseOpacity = computeOpacity(depth);
                  const depthOpacity = isScrollingUpRef.current ? Math.min(1, baseOpacity + 0.25) : baseOpacity;
                  const snapClass = entry.type === 'assistant' ? 'snap-center' : 'snap-start';

                  return (
                    <motion.div
                      key={index}
                      layout
                      className={`transition-transform duration-500 ${snapClass}`}
                      ref={(node) => {
                        if (isActiveAssistant && node) {
                          activeTurnRef.current = node;
                        } else if (!isActiveAssistant && activeTurnRef.current === node) {
                          activeTurnRef.current = null;
                        }
                        if (!node && activeTurnRef.current === node) {
                          activeTurnRef.current = null;
                        }
                      }}
                      transition={{ layout: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
                    >
                      {renderEntry(entry, index, depth, depthOpacity, isActiveAssistant)}
                    </motion.div>
                  );
                })}

                {manualClarifierActive && (
                  <SomethingElseInput
                    prompt={metadata.manualClarifier?.prompt ?? 'Let me know what you have in mind'}
                    onSubmit={(value) => {
                      if (!value.trim()) return;
                      sendMessage(value.trim());
                    }}
                    onCancel={dismissManualClarifier}
                  />
                )}

                {metadata.validationMessage && (
                  <div className="text-sm text-content-tertiary">
                    {metadata.validationMessage}
                  </div>
                )}

                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-content-tertiary"
                  >
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-content-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-content-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-content-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm">Thinking...</span>
                  </motion.div>
                )}

                {error && (
                  <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <div ref={threadEndRef} className="h-8 snap-end" />
              </div>
            </div>
          </div>
        )}
        </div>

        <ProductDrawer
          isOpen={isDrawerOpen && !!drawerProduct}
          onClose={() => setDrawerOpen(false)}
          product={drawerProduct}
          onCompare={handleCompare}
          onAddToCart={handleAddToCart}
        />

        {hasTimeline && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: hasTimeline ? 0.6 : 0.3 }}
            className="fixed bottom-0 left-0 right-0 bg-surface-overlay/80 backdrop-blur-xl border-t border-white/20 p-6 z-40"
          >
            <div className="max-w-[1000px] mx-auto">
              <motion.div layoutId="primary-input">
                <MainInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={handleSend}
                  placeholder="Describe what you're looking for..."
                  isCompact
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>
      </LayoutGroup>
    </div>
  );
}

type DrawerProduct = {
  id: string;
  title: string;
  price: number;
  currency?: string;
  image?: string;
  description?: string | null;
  features: string[];
  variantId?: string | null;
  variants?: Array<{ id: string; title: string; color?: string }>;
};

function buildDrawerProduct(product: ProductCardType, factSheets: FactSheet[]): DrawerProduct {
  const fact = factSheets.find((sheet) => sheet.id === product.id);
  const features: string[] = [];

  if (fact?.specs) {
    Object.entries(fact.specs)
      .filter(([, value]) => value != null && value !== '')
      .forEach(([key, value]) => {
        features.push(`${formatSpecKey(key)}: ${value}`);
      });
  }

  if (!features.length && product.why_chips?.length) {
    features.push(...product.why_chips);
  }

  return {
    id: product.id,
    title: product.title,
    price: product.price,
    currency: product.currency,
    image: product.image,
    description: fact?.summary ?? product.reason ?? null,
    features,
    variantId: (product as any).variant_id ?? null,
    variants: (product as any).variants ?? undefined,
  };
}

function formatSpecKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
