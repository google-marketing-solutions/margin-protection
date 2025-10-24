// vitest.setup.ts
import '@testing-library/jest-dom/vitest';

// JSDOM doesn't implement MutationObserver. This is a minimal mock.
class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

global.MutationObserver = MockMutationObserver;
