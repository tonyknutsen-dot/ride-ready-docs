/**
 * Regression test for the optimistic onMutate cache updater used by
 * useOptimisticDocumentUpload.
 *
 * Original bug: when the React Query cache for ['overview', userId] was
 * hydrated from offline storage (PWA / mobile first-upload after refresh),
 * `old.recentDocs` was undefined and `old.recentDocs.slice(0, 3)` threw:
 *   "Cannot read properties of undefined (reading 'slice')"
 * That exception crashed the whole mutation before the upload could run.
 *
 * The fix in src/hooks/useOptimisticMutations.tsx (onMutate) must:
 *   1. Guard `recentDocs` with Array.isArray so .slice never throws
 *   2. Guard `stats` so .totalDocuments increments from 0 when missing
 *   3. Be wrapped in try/catch so the mutationFn (real upload) still runs
 *
 * Run with:  bunx vitest run  (if vitest is installed)
 *        or: bun test src/hooks/__tests__/useOptimisticDocumentUpload.regression.test.ts
 */

// Pure replica of the cache-updater logic from onMutate. Keep in sync with
// src/hooks/useOptimisticMutations.tsx lines ~164-182.
export function applyOptimisticOverview(
  old: any,
  params: { documentName: string; documentType: string }
): any {
  if (!old || typeof old !== 'object') return old;
  const prevStats = (old.stats && typeof old.stats === 'object') ? old.stats : {};
  const prevTotal = typeof prevStats.totalDocuments === 'number' ? prevStats.totalDocuments : 0;
  const prevRecent = Array.isArray(old.recentDocs) ? old.recentDocs : [];
  return {
    ...old,
    stats: { ...prevStats, totalDocuments: prevTotal + 1 },
    recentDocs: [
      {
        name: params.documentName,
        date: 'today',
        type: params.documentType,
        _optimistic: true,
      },
      ...prevRecent.slice(0, 3),
    ],
  };
}

// Minimal test harness — works with both bun:test and vitest.
let test: any, expect: any;
try {
  // @ts-ignore
  ({ test, expect } = await import('bun:test'));
} catch {
  // @ts-ignore
  ({ test, expect } = await import('vitest'));
}

const params = { documentName: 'Insurance 2026', documentType: 'insurance' };

test('does not throw when recentDocs is undefined (PWA cold cache)', () => {
  const old = { stats: { totalDocuments: 5 } }; // no recentDocs at all
  expect(() => applyOptimisticOverview(old, params)).not.toThrow();
  const result = applyOptimisticOverview(old, params);
  expect(Array.isArray(result.recentDocs)).toBe(true);
  expect(result.recentDocs[0]._optimistic).toBe(true);
  expect(result.stats.totalDocuments).toBe(6);
});

test('does not throw when stats is undefined', () => {
  const old = { recentDocs: [] };
  expect(() => applyOptimisticOverview(old, params)).not.toThrow();
  const result = applyOptimisticOverview(old, params);
  expect(result.stats.totalDocuments).toBe(1);
});

test('does not throw when overview is null or empty', () => {
  expect(() => applyOptimisticOverview(null, params)).not.toThrow();
  expect(() => applyOptimisticOverview(undefined, params)).not.toThrow();
  expect(() => applyOptimisticOverview({}, params)).not.toThrow();
});

test('does not throw when recentDocs is a non-array garbage value', () => {
  for (const bad of [null, 'string', 42, {}, true]) {
    const old = { recentDocs: bad, stats: { totalDocuments: 0 } };
    expect(() => applyOptimisticOverview(old, params)).not.toThrow();
    const result = applyOptimisticOverview(old, params);
    expect(Array.isArray(result.recentDocs)).toBe(true);
  }
});

test('preserves up to 3 previous recent docs', () => {
  const old = {
    stats: { totalDocuments: 10 },
    recentDocs: [
      { name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' },
    ],
  };
  const result = applyOptimisticOverview(old, params);
  expect(result.recentDocs).toHaveLength(4); // new + 3 prev
  expect(result.recentDocs[0].name).toBe(params.documentName);
  expect(result.recentDocs[1].name).toBe('A');
  expect(result.recentDocs[3].name).toBe('C');
});
