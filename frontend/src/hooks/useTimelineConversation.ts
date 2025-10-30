import { useState, useCallback, useRef, useEffect } from 'react';

import type { Message, Segment, SSEEvent, SSEDoneMetadata, ConversationMetadata, Filter } from '../types/conversation';
import type { TimelineEntry, AssistantResponse, SystemEvent } from '../types/timeline';

interface UseTimelineConversationOptions {
  shop: string;
  apiUrl?: string;
}

const DEFAULT_API_URL = 'http://localhost:4001';

const CLIENT_API_KEY =
  process.env.NEXT_PUBLIC_CLIENT_KEY ?? process.env.NEXT_PUBLIC_CONCIERGE_CLIENT_KEY ?? '';

const withClientHeaders = (headers: HeadersInit = {}): HeadersInit =>
  CLIENT_API_KEY
    ? {
        ...headers,
        'x-concierge-client-key': CLIENT_API_KEY,
      }
    : headers;

const buildConversationMetadata = (metadata?: SSEDoneMetadata): ConversationMetadata => {
  if (!metadata) {
    return {
      sessionKey: undefined,
      askedSlot: null,
      clarifierOptions: [],
      tone: null,
      stage: null,
      mode: null,
      layoutHints: null,
      choiceOverload: false,
      recommendedSetSize: null,
      validationMessage: null,
      factSheets: undefined,
      rapportMode: false,
      infoMode: false,
      pendingClarifier: null,
      manualClarifier: null,
    };
  }

  return {
    sessionKey: metadata.session_key,
    askedSlot: metadata.asked_slot ?? null,
    clarifierOptions: metadata.clarifier_options ?? [],
    tone: metadata.tone ?? null,
    stage: metadata.conversation_stage ?? null,
    mode: metadata.conversation_mode ?? null,
    rapportMode: metadata.rapport_mode ?? false,
    infoMode: metadata.info_mode ?? false,
    layoutHints: (metadata.layout_hints ?? metadata.ui_hints ?? null) as Record<string, unknown> | null,
    choiceOverload: metadata.choice_overload ?? false,
    recommendedSetSize: metadata.recommended_set_size ?? null,
    validationMessage: metadata.validation_message ?? null,
    factSheets: metadata.fact_sheets ?? undefined,
    pendingClarifier: metadata.pending_clarifier ?? null,
    manualClarifier: metadata.manual_clarifier ?? null,
  };
};

const mergeMetadata = (
  previous: ConversationMetadata,
  update: ConversationMetadata
): ConversationMetadata => ({
  sessionKey: update.sessionKey ?? previous.sessionKey,
  askedSlot: update.askedSlot,
  clarifierOptions: update.clarifierOptions ?? previous.clarifierOptions,
  tone: update.tone ?? previous.tone,
  stage: update.stage ?? previous.stage,
  mode: update.mode ?? previous.mode,
  layoutHints: update.layoutHints ?? previous.layoutHints,
  choiceOverload: update.choiceOverload ?? previous.choiceOverload,
  recommendedSetSize: update.recommendedSetSize ?? previous.recommendedSetSize,
  validationMessage: update.validationMessage ?? null,
  factSheets: update.factSheets ?? previous.factSheets,
  rapportMode: update.rapportMode ?? previous.rapportMode,
  infoMode: update.infoMode ?? previous.infoMode,
  pendingClarifier: update.pendingClarifier ?? previous.pendingClarifier ?? null,
  manualClarifier: update.manualClarifier ?? previous.manualClarifier ?? null,
});

const createAssistantResponse = (segments: Segment[], metadata?: ConversationMetadata): AssistantResponse => ({
  id: `assistant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  segments,
  isActive: true,
  metadata,
  selectedOption: null,
  selectedOptionLabel: null,
  keepActive: false,
});

const extractNarrativeFromSegments = (segments: Segment[]): string => {
  const narrative = segments.find((segment) => segment.type === 'narrative');
  if (narrative && narrative.type === 'narrative') {
    return narrative.text;
  }
  const fallback = segments.find((segment) => segment.type === 'products');
  if (fallback && fallback.type === 'products') {
    return fallback.items.map((item) => item.title).join(', ');
  }
  return 'Assistant responded';
};

export function useTimelineConversation({
  shop,
  apiUrl = DEFAULT_API_URL,
}: UseTimelineConversationOptions) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ConversationMetadata>(() => buildConversationMetadata());
  const [manualClarifierActive, setManualClarifierActive] = useState(false);

  const [sessionKey] = useState(() => {
    if (typeof window !== 'undefined') {
      const existing = localStorage.getItem('insite-session-key');
      if (existing) return existing;
      const fresh = crypto.randomUUID();
      localStorage.setItem('insite-session-key', fresh);
      return fresh;
    }
    return crypto.randomUUID();
  });

  const activeAssistantRef = useRef<{ id: string; index: number } | null>(null);
  const pendingTimeouts = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const appendTimelineEntry = useCallback((entry: TimelineEntry) => {
    setTimeline((prev) => [...prev, entry]);
  }, []);

  const updateAssistantEntry = useCallback((id: string, updater: (response: AssistantResponse) => AssistantResponse) => {
    setTimeline((prev) => {
      const next = [...prev];
      const index = next.findIndex((entry) => entry.type === 'assistant' && entry.response.id === id);
      if (index >= 0) {
        const target = next[index];
        if (target.type === 'assistant') {
          const updatedResponse = updater(target.response);
          const updatedEntry: TimelineEntry = {
            type: 'assistant',
            response: updatedResponse,
          };
          next[index] = updatedEntry;
          activeAssistantRef.current = { id, index };
        }
      }
      return next;
    });
  }, []);

  const beginAssistantTurn = useCallback(() => {
    const response = createAssistantResponse([]);
    setTimeline((prev) => {
      const next = prev.map<TimelineEntry>((entry) =>
        entry.type === 'assistant'
          ? {
              type: 'assistant',
              response: {
                ...entry.response,
                isActive: entry.response.keepActive ?? false,
                keepActive: false,
              },
            }
          : entry
      );
      const index = next.length;
      activeAssistantRef.current = { id: response.id, index };
      const assistantEntry: TimelineEntry = { type: 'assistant', response };
      next.push(assistantEntry);
      return next;
    });

    const timeoutId = setTimeout(() => {
      setTimeline((prev) =>
        prev.map<TimelineEntry>((entry) =>
          entry.type === 'assistant'
            ? {
                type: 'assistant',
                response: {
                  ...entry.response,
                  isActive: entry.response.id === response.id,
                },
              }
            : entry
        )
      );
      pendingTimeouts.current = pendingTimeouts.current.filter((id) => id !== timeoutId);
    }, 220);

    pendingTimeouts.current.push(timeoutId);

    return response.id;
  }, []);

  const handleSSE = useCallback(
    async (response: Response) => {
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      let activeId: string | null = null;
      const decoder = new TextDecoder();
      const currentSegments: Segment[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const chunk of events) {
          if (!chunk.startsWith('data: ')) continue;
          const payload = JSON.parse(chunk.slice(6)) as SSEEvent;

          if (payload.type === 'segment') {
            if (!activeId) {
              activeId = beginAssistantTurn();
            }

            currentSegments.push(payload.segment);
            const segmentsSnapshot = [...currentSegments];
            updateAssistantEntry(activeId, (resp) => ({
              ...resp,
              segments: segmentsSnapshot,
            }));
          } else if (payload.type === 'done') {
            const meta = buildConversationMetadata(payload.metadata);
            setMetadata((prev) => mergeMetadata(prev, meta));
            const shouldShowManual = Boolean(meta.manualClarifier?.facet)
              || (Boolean(meta.askedSlot) && (meta.clarifierOptions?.length ?? 0) === 0);
            setManualClarifierActive(shouldShowManual);

            if (activeId) {
              const segmentsSnapshot = [...currentSegments];
              updateAssistantEntry(activeId, (resp) => ({
                ...resp,
                segments: segmentsSnapshot,
                metadata: mergeMetadata(resp.metadata ?? buildConversationMetadata(), meta),
                isActive: true,
              }));
            }

            const narrative = extractNarrativeFromSegments(currentSegments);
            const assistantMessage: Message = {
              role: 'assistant',
              content: narrative,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
          } else if (payload.type === 'error') {
            throw new Error(payload.error || 'Unknown error');
          }
        }
      }
    },
    [beginAssistantTurn, updateAssistantEntry]
  );

  const sendMessage = useCallback(
    async (
      content: string,
      { suppressBubble = false }: { suppressBubble?: boolean } = {}
    ) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const userMessage: Message = {
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);
      setManualClarifierActive(false);

      if (!suppressBubble) {
        appendTimelineEntry({
          type: 'user',
          message: { message: trimmed, timestamp: userMessage.timestamp! },
        });
      }

      try {
        const response = await fetch(`${apiUrl}/api/chat-natural-v2`, {
          method: 'POST',
          headers: withClientHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            messages: [...messages, userMessage].map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            shopDomain: shop,
            sessionId: sessionKey,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        await handleSSE(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send message';
        setError(message);
        console.error('Conversation error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl, appendTimelineEntry, handleSSE, messages, sessionKey, shop]
  );

  const selectOption = useCallback(
    (value: string | undefined, label: string) => {
      const display = label.trim();
      const resolved = value?.trim() || display;
      if (!resolved) return;

      if (!/skip/.test(resolved.toLowerCase()) && resolved !== '__something_else') {
        setFilters((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            label,
            value: resolved,
            facet: 'option',
          },
        ]);
      }

      setTimeline((prev) => {
        const next = [...prev];
        for (let index = next.length - 1; index >= 0; index -= 1) {
          const entry = next[index];
          if (entry.type === 'assistant') {
            const updated: TimelineEntry = {
              type: 'assistant',
              response: {
                ...entry.response,
                selectedOption: resolved,
                selectedOptionLabel: label,
                isActive: true,
                keepActive: true,
              },
            };
            next[index] = updated;
            break;
          }
        }
        return next;
      });

      if (resolved === '__something_else') {
        setManualClarifierActive(true);
        setMetadata((prev) => ({
          ...prev,
          manualClarifier:
            prev.manualClarifier ?? {
              facet: prev.askedSlot ?? 'preference',
              prompt:
                (prev.layoutHints as any)?.notes?.[0]
                ?? (prev.layoutHints as any)?.suggested_actions?.[0]
                ?? 'Tell me what to prioritize and I’ll adjust.',
            },
        }));
        return;
      }

      sendMessage(resolved, { suppressBubble: true });
    },
    [sendMessage, setMetadata]
  );

  const removeFilter = useCallback((filterId: string) => {
    setFilters((prev) => prev.filter((filter) => filter.id !== filterId));
  }, []);

  const recordSystemEvent = useCallback(
    async (event: SystemEvent) => {
      appendTimelineEntry({ type: 'system', event });

      try {
        await fetch(`${apiUrl}/api/events`, {
          method: 'POST',
          headers: withClientHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            shopDomain: shop,
            sessionId: sessionKey,
            event,
          }),
        });
      } catch (err) {
        console.warn('Failed to record system event', err);
      }
    },
    [apiUrl, appendTimelineEntry, sessionKey, shop]
  );

  const dismissManualClarifier = useCallback(() => {
    setManualClarifierActive(false);
    setMetadata((prev) => ({ ...prev, manualClarifier: null }));
    setTimeline((prev) => {
      const next = [...prev];
      for (let index = next.length - 1; index >= 0; index -= 1) {
        const entry = next[index];
        if (entry.type === 'assistant' && entry.response.selectedOption === '__something_else') {
          next[index] = {
            type: 'assistant',
            response: {
              ...entry.response,
              selectedOption: null,
              selectedOptionLabel: null,
              keepActive: false,
              isActive: true,
            },
          };
          break;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => () => {
    pendingTimeouts.current.forEach((id) => clearTimeout(id));
    pendingTimeouts.current = [];
  }, []);

  return {
    timeline,
    filters,
    isLoading,
    error,
    metadata,
    manualClarifierActive,
    sessionKey,
    sendMessage,
    selectOption,
    removeFilter,
    recordSystemEvent,
    dismissManualClarifier,
  };
}

export type UseTimelineConversationReturn = ReturnType<typeof useTimelineConversation>;
