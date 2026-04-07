
# Fix hand tracking stuck at 0 FPS / 0 hands

## Do I know what the issue is?
Yes. The camera/video stream is working because emotion detection still works. The broken part is the MediaPipe Hands pipeline.

## What is actually failing
- `useHandTracking` loads MediaPipe assets from an unpinned CDN URL while the app imports a specific local `@mediapipe/hands` version.
- The hook marks the camera as active before hand tracking is truly ready, so the UI can show a live feed with `0 FPS · 0 hands` even when Hands initialization is stalled or failed.
- Hand-tracking errors are mostly hidden, because the current error UI only shows when the camera is inactive.

## Plan
1. Update `src/hooks/useHandTracking.ts`
   - Pin `locateFile` to the exact installed MediaPipe version (`@mediapipe/hands@0.4.1675469240`).
   - Keep hand tracking in a real loading state until `hands.initialize()` completes.
   - Add an initialization timeout so it cannot hang forever in a fake “started” state.
   - If GPU init or repeated `hands.send()` calls fail, recreate Hands once with CPU inference fallback.
   - Only mark tracking as ready after initialization succeeds; otherwise set a visible hand-tracking error and stop the failed loop cleanly.

2. Improve the main camera UI in `src/pages/Index.tsx`
   - Show hand-tracking loading/error state while the camera feed is visible.
   - Do not show the `0 FPS · 0 hands` badge until tracking is actually ready.
   - If fallback mode is used, show a small compatibility message instead of silently failing.

3. Mirror the same status handling in `src/pages/PlayCanvas.tsx`
   - Reuse the hook’s loading/error/ready state so the game page does not look broken when hand tracking is unavailable.

## Technical details
- Introduce a separate tracking-ready status instead of relying on `isActive` alone.
- Use a local MediaPipe version constant in the hook for all CDN assets.
- Use a typed cast/local extended options type for `useCpuInference`, because the runtime supports it even though the current TypeScript type does not expose it.
- Leave `useFaceEmotion` unchanged; it already proves the camera is healthy.

## Files
- Edit: `src/hooks/useHandTracking.ts`
- Edit: `src/pages/Index.tsx`
- Edit: `src/pages/PlayCanvas.tsx`

## Expected result
- Start Camera shows the live video immediately plus a real hand-model loading state.
- When initialization succeeds, FPS rises above 0 and gestures/string/drawing start working.
- If GPU mode fails on preview or published site, the app falls back instead of staying stuck at `0 FPS · 0 hands`.
