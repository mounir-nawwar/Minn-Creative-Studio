interface PerformanceEntry {
  name: string;
  duration: number;
  timestamp: number;
}

export interface PerformanceMetrics {
  validationTime: number[];
  cacheHitRate: number;
  renderCount: number;
  averageValidationTime: number;
  slowOperations: PerformanceEntry[];
  maxValidationTime: number;
  minValidationTime: number;
}

export interface PerformanceSnapshot {
  validationTime: number[];
  cacheHitRate: number;
  renderCount: number;
  averageValidationTime: number;
  slowOperations: PerformanceEntry[];
  maxValidationTime: number;
  minValidationTime: number;
  totalOperations: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    validationTime: [],
    cacheHitRate: 0,
    renderCount: 0,
    averageValidationTime: 0,
    slowOperations: [],
    maxValidationTime: 0,
    minValidationTime: Infinity
  };

  private cacheHits = 0;
  private cacheMisses = 0;

  /**
   * Measures the execution time of an operation
   * @param operation - The function to measure
   * @param operationName - Optional name for the operation (defaults to 'validation')
   * @returns The result of the operation
   */
  measureValidation<T>(operation: () => T, operationName: string = 'validation'): T {
    const start = performance.now();
    const result = operation();
    const duration = performance.now() - start;

    // Track validation time
    this.metrics.validationTime.push(duration);
    
    // Update min/max
    this.metrics.minValidationTime = Math.min(this.metrics.minValidationTime, duration);
    this.metrics.maxValidationTime = Math.max(this.metrics.maxValidationTime, duration);

    // Check if this is a slow operation (>16ms frame budget)
    if (duration > 16) {
      this.metrics.slowOperations.push({
        name: operationName,
        duration,
        timestamp: Date.now()
      });
      console.warn(`[Performance Monitor] Slow ${operationName}: ${duration.toFixed(2)}ms`);
    }
    
    return result;
  }

  /**
   * Increment render count for tracking re-renders
   */
  incrementRenderCount(): void {
    this.metrics.renderCount++;
  }

  /**
   * Record a cache hit for hit rate calculation
   */
  recordCacheHit(): void {
    this.cacheHits++;
    this.updateCacheHitRate();
  }

  /**
   * Record a cache miss for hit rate calculation
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
    this.updateCacheHitRate();
  }

  /**
   * Update cache hit rate
   * @private
   */
  private updateCacheHitRate(): void {
    const total = this.cacheHits + this.cacheMisses;
    if (total > 0) {
      this.metrics.cacheHitRate = this.cacheHits / total;
    }
  }

  /**
   * Calculate and return performance metrics
   */
  getMetrics(): PerformanceSnapshot {
    const validationTimes = this.metrics.validationTime;
    const averageValidationTime = validationTimes.length > 0 
      ? validationTimes.reduce((sum, time) => sum + time, 0) / validationTimes.length
      : 0;

    // Keep only the last 100 measurements to prevent memory leaks
    if (validationTimes.length > 100) {
      this.metrics.validationTime = validationTimes.slice(-100);
    }

    // Keep only the last 20 slow operations
    if (this.metrics.slowOperations.length > 20) {
      this.metrics.slowOperations = this.metrics.slowOperations.slice(-20);
    }

    // Update metrics object
    this.metrics.averageValidationTime = averageValidationTime;

    return {
      ...this.metrics,
      averageValidationTime,
      totalOperations: this.metrics.validationTime.length
    };
  }

  /**
   * Check if a number is within performance budget
   */
  isWithinBudget(duration: number, budgetMs = 16): boolean {
    return duration <= budgetMs;
  }

  /**
   * Clear all metrics (useful for resetting between workflows)
   */
  clearMetrics(): void {
    this.metrics = {
      validationTime: [],
      cacheHitRate: this.metrics.cacheHitRate, // Keep hit rate for continuity
      renderCount: 0,
      averageValidationTime: 0,
      slowOperations: [],
      maxValidationTime: 0,
      minValidationTime: Infinity
    };
  }

  /**
   * Add a performance mark (native browser API)
   */
  mark(name: string): void {
    if (performance.mark) {
      performance.mark(name);
    }
  }

  /**
   * Measure between marks (native browser API)
   */
  measure(name: string, startMark: string, endMark: string): number {
    if (!performance.mark || !performance.measure) {
      return 0;
    }

    try {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name);
      const duration = entries.length > 0 ? entries[entries.length - 1].duration : 0;
      
      // Clean up marks to avoid memory leaks
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      performance.clearMeasures(name);

      return duration;
    } catch (error) {
      console.warn(`[Performance Monitor] Failed to measure ${name}:`, error);
      return 0;
    }
  }

  /**
   * Clear all performance marks and measures
   */
  clearMarks(): void {
    if (performance.clearMarks) {
      performance.clearMarks();
    }
    if (performance.clearMeasures) {
      performance.clearMeasures();
    }
  }
}

export const perfMonitor = new PerformanceMonitor();

// Expose for debugging in development
if (process.env.NODE_ENV === 'development') {
  (window as any).perfMonitor = perfMonitor;
}
