

# Fix: "k8.Hands is not a constructor" Error

## Root Cause
The `@mediapipe/hands` package does NOT use standard ES module exports. It uses a closure-based pattern (`za("Hands", od)`) that attaches `Hands` to the global `this` scope. The named import `import { Hands } from "@mediapipe/hands"` works in dev mode (Vite treats CJS differently) but fails in production builds where tree-shaking/minification breaks the reference, producing the cryptic "k8.Hands is not a constructor" error.

## Fix

**Edit**: `src/hooks/useHandTracking.ts`

Change the import from a named import to a namespace import, then access `Hands` from the namespace:

```typescript
// Before (broken in prod):
import { Hands, Results } from "@mediapipe/hands";

// After (works in both dev and prod):
import * as handsModule from "@mediapipe/hands";
type Results = any; // Results type isn't exported properly either
```

Then in the code, replace `new Hands(...)` with `new handsModule.Hands(...)`.

Additionally, add the `@mediapipe/hands` package to Vite's `optimizeDeps.include` config in `vite.config.ts` to ensure proper pre-bundling:

```typescript
optimizeDeps: {
  include: ["@mediapipe/hands"],
},
```

### Files
- **Edit**: `src/hooks/useHandTracking.ts` — change import style
- **Edit**: `vite.config.ts` — add optimizeDeps for mediapipe

