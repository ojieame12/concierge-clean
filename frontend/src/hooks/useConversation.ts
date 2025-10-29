import { useState, useCallback, useRef } from 'react';
import type {
  Message,
  Segment,
  SSEEvent,
  Filter,
  ConversationMetadata,
} from '@insite/concierge-ui/types/conversation';

interface UseConversationOptions {
  shop: string;
  apiUrl?: string;
}

export function useConversation({ shop, apiUrl = 'http://localhost:4001' }: UseConversationOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ConversationMetadata>({
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
  });
  const [manualClarifierActive, setManualClarifierActive] = useState(false);
  const [sessionKey] = useState(() => {
    if (typeof window !== 'undefined') {
      let key = localStorage.getItem('insite-session-key');
      if (!key) {
        key = crypto.randomUUID();
        localStorage.setItem('insite-session-key', key);
      }
      return key;
    }
    return crypto.randomUUID();
  });

  const currentSegmentsRef = useRef<Segment[]>([]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Add user message
      const userMessage: Message = {
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);
      currentSegmentsRef.current = [];
      setManualClarifierActive(false);
      setMetadata((prev) => ({
        ...prev,
        askedSlot: null,
        clarifierOptions: [],
        layoutHints: prev.layoutHints ?? null,
        validationMessage: null,
      }));

      try {
        const response = await fetch(`${apiUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            shopDomain: shop,
            sessionId: sessionKey,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Parse SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            try {
              const event: SSEEvent = JSON.parse(line.slice(6));

              if (event.type === 'segment') {
                currentSegmentsRef.current.push(event.segment);
                setSegments([...currentSegmentsRef.current]);
              } else if (event.type === 'done') {
                // Conversation turn complete
                const assistantMessage: Message = {
                  role: 'assistant',
                  content: extractNarrative(currentSegmentsRef.current),
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, assistantMessage]);

                if (event.metadata) {
                  const {
                    session_key,
                    asked_slot,
                    clarifier_options,
                    tone,
                    conversation_stage,
                    conversation_mode,
                    layout_hints,
                    ui_hints,
                    choice_overload,
                    recommended_set_size,
                    validation_message,
                  } = event.metadata;

                  setMetadata({
                    sessionKey: session_key,
                    askedSlot: asked_slot ?? null,
                    clarifierOptions: clarifier_options ?? [],
                    tone: tone ?? null,
                    stage: conversation_stage ?? null,
                    mode: conversation_mode ?? null,
                    layoutHints: (layout_hints ?? ui_hints ?? null) as Record<string, unknown> | null,
                    choiceOverload: choice_overload ?? false,
                    recommendedSetSize: recommended_set_size ?? null,
                    validationMessage: validation_message ?? null,
                  });

                  const hasClarifier = Boolean(asked_slot);
                  const optionsCount = clarifier_options?.length ?? 0;
                  setManualClarifierActive(hasClarifier && optionsCount === 0);
                }
              } else if (event.type === 'error') {
                throw new Error(event.error || 'Unknown error');
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message');
        console.error('Conversation error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, shop, apiUrl, sessionKey]
  );

  const removeFilter = useCallback((filterId: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== filterId));
    // Could trigger a new search with updated filters
  }, []);

  const selectOption = useCallback(
    (value: string, label: string) => {
      const resolved = value ?? label;

      // When user clicks an option button, send it as their message
      sendMessage(resolved);

      // Skip adding filters for skip/other control actions
      if (!resolved || /skip/.test(resolved.toLowerCase())) {
        return;
      }

      setFilters((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          label,
          value: resolved,
          facet: 'option',
        },
      ]);
    },
    [sendMessage]
  );

  return {
    messages,
    segments,
    filters,
    isLoading,
    error,
    sessionKey,
    metadata,
    manualClarifierActive,
    sendMessage,
    selectOption,
    removeFilter,
  };
}

// Helper to extract narrative text from segments
function extractNarrative(segments: Segment[]): string {
  const narrativeSegment = segments.find((s) => s.type === 'narrative');
  return narrativeSegment && narrativeSegment.type === 'narrative'
    ? narrativeSegment.text
    : 'Assistant responded';
}
