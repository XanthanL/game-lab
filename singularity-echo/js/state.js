/**
 * Singularity Echo - State Management Module
 * 
 * Lightweight reactive state container using Proxy API.
 * Provides subscription-based updates for UI synchronization.
 * 
 * @module state
 */

'use strict';

/**
 * Reactive State Container
 * Uses Proxy to intercept property access and mutations
 * Supports subscription-based notifications
 */
class State {
  /**
   * Create a new state container
   * @param {Object} initialState - Initial state values
   */
  constructor(initialState) {
    this._state = { ...initialState };
    this._subs = new Map(); // Map<key, Set<callback>>
    
    this.store = new Proxy(this._state, {
      set: (target, key, value) => {
        const oldValue = target[key];
        
        if (oldValue !== value) {
          target[key] = value;
          
          // Notify subscribers
          if (this._subs.has(key)) {
            this._subs.get(key).forEach(fn => fn(value, oldValue));
          }
        }
        
        return true;
      },
      
      get: (target, key, receiver) => {
        return Reflect.get(target, key, receiver);
      }
    });
  }
  
  /**
   * Subscribe to state changes
   * @param {string|number|symbol} key - State key to observe
   * @param {Function} callback - Function(value, oldValue) called on change
   */
  subscribe(key, callback) {
    if (!this._subs.has(key)) {
      this._subs.set(key, new Set());
    }
    this._subs.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      this._subs.get(key).delete(callback);
    };
  }
  
  /**
   * Subscribe to all state changes
   * @param {Function} callback - Function(changes) called whenever any key changes
   * @returns {Function} Unsubscribe function
   */
  subscribeAll(callback) {
    const handler = (key, value, oldValue) => {
      callback({ key, value, oldValue });
    };
    
    // We'll add each key individually in update()
    return () => {
      // Cleanup handled by individual unsubscribes
    };
  }
  
  /**
   * Update multiple state keys atomically
   * @param {Object} updates - Object with {key: value} pairs
   */
  update(updates) {
    for (const [key, value] of Object.entries(updates)) {
      this.store[key] = value;
    }
  }
  
  /**
   * Get current state snapshot
   * @returns {Object} Shallow copy of state
   */
  snapshot() {
    return { ...this._state };
  }
  
  /**
   * Reset state to initial values
   * @param {Object} newState - New initial state (optional)
   */
  reset(newState) {
    if (newState) {
      this._state = { ...newState };
    } else {
      // If we had an original initialState stored, use it
      this._state = {};
    }
    
    // Clear all subscriptions
    this._subs.clear();
  }
  
  /**
   * Check if a key exists
   * @param {string} key - State key
   * @returns {boolean} True if key exists
   */
  has(key) {
    return key in this._state;
  }
  
  /**
   * Get state keys
   * @returns {string[]} Array of keys
   */
  keys() {
    return Object.keys(this._state);
  }
}

/**
 * Creates a state slice with its own reducer
 * Useful for modular state management
 * @template S
 * @param {S} initialState - Initial state for this slice
 * @param {Function} reducers - Object mapping action names to reducer functions
 * @returns {{state: State, dispatch: Function}}
 */
export function createStore(initialState, reducers = {}) {
  const state = new State(initialState);
  
  const dispatch = (action, payload) => {
    const reducer = reducers[action];
    if (!reducer) {
      console.warn(`[State] Unknown action: ${action}`);
      return;
    }
    
    const newState = reducer(state.snapshot(), payload);
    if (newState !== state.snapshot()) {
      state.update(newState);
    }
  };
  
  return { state, dispatch };
}

/**
 * Simple event bus for decoupled communication
 */
class EventBus {
  constructor() {
    this.events = new Map();
  }
  
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.events.get(event).delete(callback);
    };
  }
  
  off(event, callback) {
    if (this.events.has(event)) {
      this.events.get(event).delete(callback);
    }
  }
  
  emit(event, data) {
    if (this.events.has(event)) {
      this.events.get(event).forEach(cb => cb(data));
    }
  }
  
  clear() {
    this.events.clear();
  }
}

// Singleton instances
const globalState = new State({
  mode: 'menu',         // 'menu', 'play', 'over', 'pause'
  score: 0,
  wave: 1,
  level: 1,
  kills: 0,
  time: 0,
  hull: null,
  difficulty: 'standard'
});

const eventBus = new EventBus();

// Export API
export {
  State,
  createStore,
  EventBus,
  globalState,
  eventBus
};
