import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';

// Global test setup
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock performance API for testing
global.performance.mark = vi.fn();
global.performance.measure = vi.fn(() => ({
  duration: 0,
  startTime: 0,
  endTime: 0,
})) as any;
global.performance.clearMarks = vi.fn();
global.performance.clearMeasures = vi.fn();

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock console methods to reduce noise in test output
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  // Suppress expected warnings/errors in tests
  console.warn = vi.fn((...args: any[]) => {
    // Only log if it's not an expected connection validation message
    const message = args[0]?.toString() || '';
    if (!message.includes('cannot connect') && 
        !message.includes('Type mismatch') &&
        !message.includes('Cannot connect') &&
        !message.includes('Connection Validator')) {
      originalConsoleWarn(...args);
    }
  });
  
  console.error = vi.fn((...args: any[]) => {
    // Only log if it's not an expected error
    const message = args[0]?.toString() || '';
    if (!message.includes('Invalid')) {
      originalConsoleError(...args);
    }
  });
});

afterAll(() => {
  // Restore original console methods
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});
