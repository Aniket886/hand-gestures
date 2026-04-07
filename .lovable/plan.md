

# Fix Camera Not Opening on Published Website

## Problem
The published site at `hand-gestures.lovable.app` uses HTTPS. The `navigator.mediaDevices.getUserMedia` API requires a **secure context** (HTTPS or localhost), which the published site has — so that's not the issue.

The likely cause is that the **Permissions-Policy header** or a browser security restriction is blocking camera access in the published iframe/context, OR the camera code silently fails without user feedback.

However, the most common root cause for "works in preview but not published" with MediaPipe is:

1. **Mixed content**: The MediaPipe CDN loads over HTTPS, so that's fine.
2. **Silent failure with no error feedback**: The `start` function catches errors but only logs to console — the user sees nothing.
3. **Refs not ready**: `videoRef.current` or `canvasRef.current` might be null at click time, causing the early `return` on line 105 with no feedback.

## Plan

### 1. Add visible error handling to camera start (`src/hooks/useHandTracking.ts`)
- Add an `error` field to `HandTrackingState`
- When `videoRef`/`canvasRef` are null, set an error message instead of silently returning
- When `getUserMedia` fails, set a user-visible error message
- When MediaPipe `Hands` fails to initialize, catch and surface that error too

### 2. Show error state in UI (`src/pages/Index.tsx`)
- Display the error message from the hand tracking state in the camera placeholder area
- Include guidance like "Please allow camera access" or "Camera not available"

### 3. Add `navigator.mediaDevices` availability check
- Before calling `getUserMedia`, check if `navigator.mediaDevices` exists (it's undefined in insecure contexts)
- If unavailable, show "Camera requires HTTPS. Please use the published URL or localhost."

### Files
- **Edit**: `src/hooks/useHandTracking.ts` — add error state, guard checks, visible error messages
- **Edit**: `src/pages/Index.tsx` — display error in camera area

