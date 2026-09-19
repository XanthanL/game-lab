# Singularity Echo - Module Architecture (v2.0)

## 📁 Project Structure

```
singularity-echo/
├── index.html              # Main game page (to be refactored)
├── js-test.html            # Standalone module test page
├── css/                    # Stylesheets (future)
│   └── design-system.css
├── js/                     # JavaScript modules
│   ├── main.js             # Entry point & API exports
│   ├── rng.js              # Random number generation
│   ├── tokens.js           # Design tokens & color system
│   ├── utils.js            # Utility functions
│   ├── state.js            # State management
│   ├── error.js            # Error handling
│   └── ...                 # Future: game.js, ui.js, audio.js
└── test/                   # Test suites
    ├── unit/               # Jest unit tests
    └── e2e/                # Playwright E2E tests
```

---

## 🔧 Core Modules

### **1. RNG (Random Number Generation)**
**File**: `rng.js`  
**Purpose**: Seeded PRNG for deterministic gameplay runs

**Key Features**:
- Mulberry32 algorithm for reproducible randomness
- Two-layer design: seeded (layout) vs unseeded (combat visuals)
- Reseed at context keys for deterministic progression
- Base36 encoding for shareable seed codes

**API**:
```javascript
import { setSeed, rand, irand, pick, shuffle } from './rng.js';

setSeed(12345);
const value = rand(0, 100); // [0, 100)
const int = irand(1, 10);   // [1, 10] integer
const item = pick(array);   // Random element
shuffle(items);             // Shuffle in place
```

---

### **2. Tokens (Design System)**
**File**: `tokens.js`  
**Purpose**: Read CSS custom properties and provide color palette

**Key Features**:
- Single source of truth: reads from `:root` CSS variables
- Colorblind mode support (red-green / blue-yellow)
- RGBA helper with alpha transparency
- No hardcoded colors in rendering code

**API**:
```javascript
import { readPal, RGBA, RGB, applyColorblindMode } from './tokens.js';

// Read palette at startup
readPal();

// Use in canvas
ctx.fillStyle = 'rgba(' + PAL.cyan + ', 0.5)';
// Or use helper:
ctx.fillStyle = RGBA('cyan', 0.5);

// Apply colorblind mode
applyColorblindMode('rg'); // Red-green safe
```

---

### **3. Utils (Utility Functions)**
**File**: `utils.js`  
**Purpose**: Core helpers used throughout the game

**Key Features**:
- Geometric calculations (angle diff, distance)
- Number formatting with thousand separators
- Array helpers (clamp, lerp, mod)
- LocalStorage wrapper with error handling
- Performance timing utilities
- Debounce/throttle helpers

**API**:
```javascript
import { $, fmt, clamp, d2, angDiff, Storage, Perf } from './utils.js';

const el = $('#my-element');
const formatted = fmt(1234567); // "1,234,567"
const distance = d2(x1, y1, x2, y2); // Squared distance
const angle = angDiff(a, b); // [-π, π] normalized
const saved = Storage.get('key', null);
Perf.measure('operation', () => {/* work */});
```

---

### **4. State Management**
**File**: `state.js`  
**Purpose**: Reactive state container with subscriptions

**Key Features**:
- Proxy-based reactivity
- Subscription callbacks on change
- Atomic updates for multiple keys
- Snapshot for immutable access
- Event bus for decoupled communication

**API**:
```javascript
import { State, globalState, eventBus } from './state.js';

// Create custom state
const inventory = new State({ items: [], gold: 0 });

inventory.subscribe('gold', (newVal, oldVal) => {
  console.log(`Gold changed: ${oldVal} → ${newVal}`);
});

inventory.update({ gold: 100 });

// Or use global state
globalState.update({ score: 5000, wave: 5 });

// Event bus
eventBus.on('player:died', () => { /* handle death */ });
eventBus.emit('player:died', { reason: 'boss' });
```

---

### **5. Error Handling**
**File**: `error.js`  
**Purpose**: Centralized error tracking and logging

**Key Features**:
- Global error handler installation
- Severity levels (DEBUG/INFO/WARNING/ERROR/FATAL)
- Try-catch wrappers with fallbacks
- Error history & listeners
- Safe storage wrapper

**API**:
```javascript
import { errorHandler, SafeStorage, Severity } from './error.js';

// Manual reporting
errorHandler.error(new Error('Something failed'), { operation: 'loadLevel' });

// Automatic try-catch wrapper
const result = errorHandler.tryCatch(
  () => dangerousOperation(),
  { operation: 'processData' },
  () => ({ fallback: true }) // Fallback if error
);

// Wrapped function
const safeFn = errorHandler.wrap(dangerousOperation, { operation: 'safe-fn' });

// Subscribe to errors
errorHandler.subscribe(Severity.ERROR, record => {
  console.log('Error recorded:', record);
});
```

---

### **6. Main Entry Point**
**File**: `main.js`  
**Purpose**: Module aggregation and unified API

**Key Features**:
- Imports all core modules
- Game loop starter
- Compatibility checks
- Version info

**Usage**:
```html
<script type="module" src="./js/main.js"></script>
```

---

## 🚀 Development Workflow

### **Local Development Setup**

1. **Start local server** (required for ES modules):
```bash
# Using Python
python3 -m http.server 8080

# Or using Node.js
npx serve .
```

2. **Access test page**:
```
http://localhost:8080/js-test.html
```

3. **View module structure in browser dev tools**:
- Network tab: See module loading
- Console: Check initialization logs
- Coverage tab: Inspect what's executed

### **Module Import Pattern**

```javascript
// main game file
import {
  RNG,
  setSeed,
  readPal,
  $,
  State,
  errorHandler
} from './js/main.js';

// Or import specific modules directly
import { rand, irand } from './js/rng.js';
import { RGBA } from './js/tokens.js';
```

---

## 🧪 Testing

### **Manual Test Page**
Open `js-test.html` to verify all modules load correctly.

Tests include:
- ✅ RNG seeded determinism
- ✅ Utility functions
- ✅ State subscription
- ✅ Storage wrapper
- ✅ Error handling
- ✅ Browser compatibility

### **Unit Tests** (Future)
Using Jest + JSDOM:
```bash
npm install --save-dev jest jsdom
npx jest
```

Test file structure:
```
test/unit/
├── rng.test.js
├── tokens.test.js
├── utils.test.js
├── state.test.js
└── error.test.js
```

---

## 📦 Migration Plan

### **Phase 0** ✅ Complete
- [x] Split RNG module
- [x] Split Tokens module
- [x] Split Utils module
- [x] Create State management
- [x] Create Error handling
- [x] Create Main entry point
- [x] Create test page

### **Phase 1** Next Steps
- [ ] Extract Game Loop (`game.js`)
- [ ] Extract UI Components (`ui.js`)
- [ ] Extract Audio Manager (`audio.js`)
- [ ] Extract Save System (`save.js`)
- [ ] Update `index.html` with module imports

### **Phase 2** Polish
- [ ] Add Service Worker for offline support
- [ ] Configure Webpack/Vite for bundling
- [ ] Set up automated testing pipeline
- [ ] Add TypeScript definitions (optional)

---

## 💡 Best Practices

### **1. Module Organization**
- One responsibility per module
- Clear export boundaries
- Avoid circular dependencies
- Document with JSDoc comments

### **2. State Updates**
- Use `update()` for batch changes
- Subscribe to keys you care about
- Take snapshots for immutable access

### **3. Error Handling**
- Always wrap async operations
- Provide fallbacks when possible
- Log context for debugging
- Don't silently swallow errors

### **4. Performance**
- Re-read palette only when needed
- Cache expensive computations
- Use squared distances for comparisons
- Avoid object creation in tight loops

---

## 📊 Module Statistics

| Module | Lines | Exports | Complexity |
|--------|-------|---------|------------|
| rng.js | ~90 | 13 | Low |
| tokens.js | ~120 | 7 | Low |
| utils.js | ~180 | 8 | Low-Medium |
| state.js | ~150 | 4 | Medium |
| error.js | ~200 | 4 | Medium |
| main.js | ~120 | 20+ | Low |
| **Total** | **~860** | **~56** | **Low** |

---

## 🔮 Future Enhancements

- [ ] Add TypeScript for type safety
- [ ] Implement dependency injection for better testability
- [ ] Add performance monitoring hooks
- [ ] Create visual module dependency graph
- [ ] Build documentation site (AutoDoc)

---

*Last Updated: 2026-09-19*  
*Author: Qoder AI Assistant*
