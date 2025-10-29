import { describe, it, expect } from 'vitest';

import { rankCanonShards } from '../runtime-store';

describe('rankCanonShards', () => {
  it('orders shards by similarity score', () => {
    const shards = [
      { topic: 'A', assertions: ['A'], caveats: [], citation: 'doc', embedding: [1, 0, 0, 0], tags: [] },
      { topic: 'B', assertions: ['B'], caveats: [], citation: 'doc', embedding: [0, 1, 0, 0], tags: [] },
      { topic: 'C', assertions: ['C'], caveats: [], citation: 'doc', embedding: [0, 0, 1, 0], tags: [] },
    ];

    const ranked = rankCanonShards(shards, [0, 1, 0, 0], 2);
    expect(ranked[0]?.topic).toBe('B');
    expect(ranked).toHaveLength(2);
  });
});
