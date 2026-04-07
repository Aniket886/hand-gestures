

# Fix: Camera Shows Feed but Overlay Still Visible

## Problem
The camera feed is visibly playing behind the overlay, but the "Click Start Camera" message stays on top. This means `getUserMedia` succeeded (video is playing) but `isActive` never becomes `true`.

The root cause: the MediaPipe `Hands` initialization (lines 133-305) is not wrapped in a try-catch. If `new Hands()`, `hands.setOptions()`, or `hands.onResults()` throws during WASM loading, execution never reaches line 321 where `isActive` is set to `true`. The video keeps playing but the app thinks the camera isn't started.

## Fix

**Edit**: `src/hooks/useHandTracking.ts`

Wrap the entire MediaPipe initialization block (from `new Hands(...)` through setting up the frame loop and `setState({ isActive: true })`) in a try-catch. If MediaPipe fails to initialize, surface the error to the user and stop the video stream.

Move `setState({ isActive: true })` to right after the video starts playing (after line 121), so the overlay hides as soon as the camera feed is live — independent of whether MediaPipe finishes loading. MediaPipe results will start flowing once WASM loads, but the user sees the camera immediately.

### Specific changes:
1. Set `isActive: true` immediately after `videoRef.current.play()` succeeds (line 121)
2. Wrap MediaPipe init (lines 133-320) in try-catch, setting error state on failure
3. On MediaPipe init failure, also stop the video stream so state is consistent

