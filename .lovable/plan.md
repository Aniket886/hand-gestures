

# Fix: Hand Tracking Not Working (0 FPS, 0 Hands)

## Problem
The screenshot shows the camera feed is live and emotion detection works (HAPPY), but hand tracking shows "0 FPS · 0 hands". MediaPipe Hands is not processing frames.

The root cause: the frame loop starts immediately via `requestAnimationFrame` after constructing `Hands`, but MediaPipe's WASM model hasn't finished loading yet. The `hands.send()` call silently fails or rejects because initialization isn't complete. While the try-catch prevents the loop from dying, the model never actually initializes properly because there's no explicit `await hands.initialize()` call.

## Fix

**Edit**: `src/hooks/useHandTracking.ts`

1. **Add explicit `hands.initialize()` call** before starting the frame loop. This ensures the WASM model is fully loaded before we start sending frames:

```typescript
// After hands.onResults(...) setup, before the frame loop:
await hands.initialize();
```

2. **Add console logging** for initialization success/failure to help debug:

```typescript
console.log("MediaPipe Hands initialized successfully");
```

This single change — adding `await hands.initialize()` between setting up `onResults` and starting the `requestAnimationFrame` loop — should fix the issue. The model will be fully loaded before any frames are sent.

### Files
- **Edit**: `src/hooks/useHandTracking.ts` — add `await hands.initialize()` after `hands.onResults()` setup, before frame loop

