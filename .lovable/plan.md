

# Fix: Features Not Working on Published Site

## Problem
Camera opens successfully but hand tracking, gestures, and emotion detection don't work. The likely cause is that MediaPipe WASM loading or processing fails silently on the published site.

Two specific issues in `src/hooks/useHandTracking.ts`:

1. **Frame loop crashes silently** (lines 313-318): If `hands.send()` throws (e.g., WASM not fully loaded, cross-origin issue), the `await` rejects and `requestAnimationFrame` is never called again. The loop dies with no error shown to the user.

2. **No retry or error recovery**: Once the frame loop dies, the camera keeps showing but nothing processes.

## Fix

### 1. Add try-catch inside the frame loop (`src/hooks/useHandTracking.ts`)
Wrap `await hands.send({ image: videoRef.current })` in a try-catch so one failed frame doesn't kill the entire loop. Log the first error and continue retrying.

```typescript
const processFrame = async () => {
  try {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      await hands.send({ image: videoRef.current });
    }
  } catch (err) {
    console.warn("Hand tracking frame error:", err);
  }
  animId = requestAnimationFrame(processFrame);
};
```

### 2. Add tracking status indicator
Update the error state if MediaPipe repeatedly fails to process frames (e.g., after 10 consecutive failures, show a warning). This gives the user visibility into what's happening.

### 3. Add cross-origin handling for MediaPipe CDN
The `locateFile` URL uses jsDelivr which should work, but add error handling for the `Hands` constructor initialization that explicitly checks if WASM files loaded.

### Files
- **Edit**: `src/hooks/useHandTracking.ts` — resilient frame loop, error surfacing
- **Edit**: `src/hooks/useFaceEmotion.ts` — same pattern: add try-catch around detection interval

