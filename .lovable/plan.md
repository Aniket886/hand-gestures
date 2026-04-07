
# Fix hand tracking init failure on the published site

## Do I know what the issue is?
Yes.

## Problem
The camera feed is live, but hand tracking fails with: `MediaPipe Hands constructor not found`.

The current hook still relies on reading the constructor from the imported module object in `src/hooks/useHandTracking.ts`. That is the wrong runtime assumption for `@mediapipe/hands`.

I verified the package runtime in `node_modules/@mediapipe/hands/hands.js`: it registers `Hands` globally via `za("Hands", od)`, instead of exposing a stable ESM constructor. That means:
- `handsModule.Hands` can be empty in bundled builds
- `optimizeDeps.include` does not solve published builds, because it only affects Vite dev pre-bundling

## Plan
1. Replace the current top-level MediaPipe runtime import in `src/hooks/useHandTracking.ts` with a dedicated lazy loader.
   - Remove dependence on `handsModule.Hands`
   - Explicitly load the runtime script in the browser with a dynamic import of the actual runtime file
   - After it loads, resolve the constructor from `globalThis.Hands` / `window.Hands`

2. Update `createAndInitHands(...)` to use that loaded global constructor.
   - If the constructor is still missing, throw a clearer error:
     `MediaPipe Hands runtime failed to register global constructor`

3. Cache the runtime load so it only happens once.
   - Prevent repeated imports on restart
   - Keep the existing GPU → CPU fallback exactly as-is

4. Keep the rest of the hook behavior unchanged.
   - Camera starts immediately
   - Spinner/loading badge stays visible while the model initializes
   - `trackingReady`, FPS, gestures, drawing, strings, and measuring continue to work the same way once init succeeds

5. Re-check both pages that use the hook.
   - `src/pages/Index.tsx`
   - `src/pages/PlayCanvas.tsx`
   No major UI changes should be needed; both should start working once the hook initializes correctly.

## Files
- Edit: `src/hooks/useHandTracking.ts`
- Review only: `vite.config.ts`
- Review only: `src/pages/Index.tsx`
- Review only: `src/pages/PlayCanvas.tsx`

## Technical details
Recommended runtime pattern:
```ts
await import("@mediapipe/hands/hands.js");

const HandsConstructor =
  (globalThis as any).Hands ||
  (window as any).Hands;

if (!HandsConstructor) {
  throw new Error("MediaPipe Hands runtime failed to register global constructor");
}

const hands = new HandsConstructor({ locateFile });
```

## Expected result
- Camera still opens right away
- The hand-model loading state clears after initialization
- FPS rises above 0
- Hand overlay, gestures, air writing, strings, and measurement work again on published builds instead of stopping at constructor lookup
