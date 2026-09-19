/**
 * Singularity Echo - Error Handling Module
 * 
 * Centralized error handling and logging system.
 * Provides user-friendly error messages and optional crash reporting.
 * 
 * @module error
 */

'use strict';

/**
 * Error severity levels
 * @enum {string}
 */
const Severity = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  FATAL: 'fatal'
};

/**
 * Error context for better debugging
 * @typedef {Object} ErrorContext
 * @property {string} operation - What operation was being performed
 * @property {Object} data - Additional contextual data
 * @property {string} stack - Stack trace (optional)
 */

/**
 * Centralized Error Handler
 * Collects, categorizes, and reports errors
 */
class ErrorHandler {
  constructor() {
    this.errors = []; // History of recent errors
    this.maxHistory = 50;
    this.listeners = new Map(); // For custom error handlers
    
    // Bind methods to preserve 'this' context
    this.handleGlobalError = this.handleGlobalError.bind(this);
    this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
    
    // Install global error handlers
    this.install();
  }
  
  /**
   * Install global error handlers
   */
  install() {
    window.addEventListener('error', this.handleGlobalError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }
  
  /**
   * Remove global error handlers
   */
  uninstall() {
    window.removeEventListener('error', this.handleGlobalError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }
  
  /**
   * Handle global JavaScript errors
   * @param {ErrorEvent} event
   */
  handleGlobalError(event) {
    const error = new Error(event.message);
    error.file = event.filename;
    error.line = event.lineno;
    error.column = event.colno;
    
    this.report(error, {
      operation: 'Global Error',
      data: { file: event.filename, line: event.lineno, column: event.colno }
    }, Severity.ERROR);
  }
  
  /**
   * Handle unhandled promise rejections
   * @param {PromiseRejectionEvent} event
   */
  handleUnhandledRejection(event) {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    
    this.report(error, {
      operation: 'Unhandled Promise Rejection',
      data: { reason: String(event.reason) }
    }, Severity.ERROR);
  }
  
  /**
   * Report an error with context
   * @param {Error} error - Error object
   * @param {ErrorContext} context - Context information
   * @param {Severity|string} severity - Error severity level
   */
  report(error, context = {}, severity = Severity.ERROR) {
    const record = {
      error: {
        message: error.message,
        stack: error.stack || 'No stack trace',
        name: error.name || 'Error'
      },
      context,
      severity,
      timestamp: Date.now(),
      url: window.location.href
    };
    
    // Add to history
    this.errors.push(record);
    if (this.errors.length > this.maxHistory) {
      this.errors.shift(); // Remove oldest
    }
    
    // Notify listeners
    if (this.listeners.has(severity)) {
      this.listeners.get(severity).forEach(fn => fn(record));
    }
    
    // Console logging based on severity
    switch (severity) {
      case Severity.DEBUG:
        console.debug('[Debug]', record.context.operation, error.message);
        break;
      
      case Severity.INFO:
        console.info('[Info]', record.context.operation, error.message);
        break;
      
      case Severity.WARNING:
        console.warn('[Warn]', record.context.operation, error.message);
        break;
      
      case Severity.ERROR:
        console.error('[Error]', record.context.operation, error.message);
        if (error.stack) console.error(error.stack);
        break;
      
      case Severity.FATAL:
        console.error('[FATAL]', record.context.operation, error.message);
        if (error.stack) console.error(error.stack);
        break;
    }
    
    return record;
  }
  
  /**
   * Log a debug message
   * @param {...any} args - Arguments to log
   */
  debug(...args) {
    console.debug('[Debug]', ...args);
  }
  
  /**
   * Log an info message
   * @param {...any} args - Arguments to log
   */
  info(...args) {
    console.info('[Info]', ...args);
  }
  
  /**
   * Log a warning
   * @param {...any} args - Arguments to log
   */
  warn(...args) {
    console.warn('[Warn]', ...args);
  }
  
  /**
   * Log an error
   * @param {Error|string} error - Error object or message
   * @param {ErrorContext} [context] - Optional context
   */
  error(error, context = {}) {
    const err = typeof error === 'string' ? new Error(error) : error;
    this.report(err, context, Severity.ERROR);
  }
  
  /**
   * Log a fatal error (will likely terminate app)
   * @param {Error|string} error - Error object or message
   * @param {ErrorContext} [context] - Optional context
   */
  fatal(error, context = {}) {
    const err = typeof error === 'string' ? new Error(error) : error;
    this.report(err, context, Severity.FATAL);
  }
  
  /**
   * Subscribe to specific severity levels
   * @param {Severity|string} severity - Severity level
   * @param {Function} listener - Callback function
   */
  subscribe(severity, listener) {
    if (!this.listeners.has(severity)) {
      this.listeners.set(severity, new Set());
    }
    this.listeners.get(severity).add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(severity).delete(listener);
    };
  }
  
  /**
   * Get recent error history
   * @param {number} limit - Maximum number of errors to return
   * @returns {Array} Error records
   */
  getHistory(limit = 10) {
    return this.errors.slice(-limit);
  }
  
  /**
   * Clear error history
   */
  clearHistory() {
    this.errors = [];
  }
  
  /**
   * Try-catch wrapper that reports errors automatically
   * @template T
   * @param {Function} fn - Function to execute
   * @param {ErrorContext} context - Context for error reporting
   * @param {Function} fallback - Fallback function if error occurs (optional)
   * @returns {T|undefined} Return value of fn or fallback result
   */
  tryCatch(fn, context, fallback) {
    try {
      return fn();
    } catch (e) {
      this.report(e, context, Severity.ERROR);
      if (fallback) {
        try {
          return fallback();
        } catch (fallbackErr) {
          this.fatal(fallbackErr, { ...context, stage: 'fallback' });
          return undefined;
        }
      }
      return undefined;
    }
  }
  
  /**
   * Create a try-catch wrapped version of a function
   * @param {Function} fn - Function to wrap
   * @param {ErrorContext} context - Base context
   * @returns {Function} Wrapped function
   */
  wrap(fn, context) {
    return (...args) => {
      return this.tryCatch(() => fn(...args), { ...context, args }, null);
    };
  }
}

/**
 * Storage error wrapper with automatic degradation
 */
const SafeStorage = {
  set(key, value) {
    return errorHandler.tryCatch(
      () => localStorage.setItem(key, JSON.stringify(value)),
      { operation: 'localStorage.set', key },
      () => console.warn(`[SafeStorage] Failed to save ${key}, will retry later`)
    );
  },
  
  get(key, fallback = null) {
    return errorHandler.tryCatch(
      () => JSON.parse(localStorage.getItem(key)),
      { operation: 'localStorage.get', key },
      () => fallback
    ) ?? fallback;
  },
  
  remove(key) {
    return errorHandler.tryCatch(
      () => localStorage.removeItem(key),
      { operation: 'localStorage.remove', key }
    );
  }
};

// Singleton instance
const errorHandler = new ErrorHandler();

// Export API
export {
  ErrorHandler,
  Severity,
  SafeStorage,
  errorHandler
};
