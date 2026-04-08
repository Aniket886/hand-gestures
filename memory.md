# Compact Context (keep updated)

This file is the handoff log for continuing work on the `hand-gestures` repo when switching assistants/models.
Update this file after every meaningful change (feature/bugfix/deploy change), especially if work happens offline.

## Project
- Repo: `Aniket886/hand-gestures`
- App: Vite + React + TS + shadcn UI
- Main pages:
  - `/` dashboard (camera + controls)
  - `/present` presentation mode
  - `/play` mini-games

## Deployment notes (important)
- Production URL: `https://hand-gestures-lovat.vercel.app/`
- There was a recurring issue where Vercel stayed on an older commit; redeploying an old deployment does NOT pick up new commits.
- To verify the live build: open `view-source:https://hand-gestures-lovat.vercel.app/` and check the `assets/index-*.js` hash.
- PWA is enabled; Service Worker can cause stale UI. If debugging, try DevTools -> Application -> Service Workers -> Unregister, then hard refresh.

## Key features added recently

### 1) Calibration + handedness tuning
- Per-user tracking prefs with sliders and local persistence.
- Handedness smoothing + confidence threshold + debounce.
- Calibration baseline capture stored in localStorage.

Key files:
- `src/hooks/useHandTracking.ts`
- `src/hooks/useTrackingPreferences.ts`
- `src/components/TrackingCalibrationPanel.tsx`

### 2) Custom gesture trainer
- Users can record landmark samples, save a custom gesture locally, and match it in real time.

Key files:
- `src/lib/customGestures.ts` (vectorization + matching)
- `src/hooks/useCustomGestureProfiles.ts` (localStorage profiles)
- `src/components/CustomGestureTrainer.tsx`
- `src/hooks/useHandTracking.ts` (uses `matchCustomGesture`)

### 3) PWA offline mode
- Added `vite-plugin-pwa`, manifest + SW + caching rules for CDN model assets.

Key files:
- `vite.config.ts`, `src/main.tsx`, `src/vite-env.d.ts`
- Icons in `public/icons/*`, `public/apple-touch-icon.png`

### 4) Arc voice assistant (wake word + commands + Groq answers)
- Wake phrase: "Arc" with aliases (arc/ark/are).
- Wake window: saying "Arc" arms assistant for ~6s; next phrase can omit "Arc".
- Commands supported: start/stop tracking, next/prev slide, capture calibration, open presentation/playground/home, help.
- Freeform questions after wake are sent to Groq and spoken back.

Key files:
- `src/hooks/useVoiceCommandAssistant.ts`
  - Uses Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
  - Recently changed to `interimResults=true` to catch wake word better
  - Executes commands/queries only on final results to reduce accidental triggers
  - Adds basic diagnostics: "Mic active...", "Hearing speech..."
- `src/components/VoiceAssistantPanel.tsx` (detailed status panel shown inside Tools modal)
- `src/pages/Index.tsx` (wires Arc commands; includes under-camera "Arc Listening / Arc Off" chip)
- `src/pages/Presentation.tsx` (voice slide control)

Groq backend:
- Vercel function: `api/arc.js`
- Env var on Vercel: `GROQ_KEY`
- Endpoint called from client: `POST /api/arc` with `{ prompt }`

Tests:
- `src/test/voiceAssistant.test.ts` covers normalize/wake parsing/wake window interpreter.

## Current known issue / why this file exists
- Voice assistant sometimes did not "catch" the wake word ("Arc"). A fix was applied to use interim results and add diagnostics.
- If "Last heard" stays `-` while mic is on, likely `onresult` is not firing (browser/permission/support issue).

## UI layout change
- Quick toggles remain under the camera for fast access.
- "Tools" modal contains advanced panels (calibration, custom gesture trainer, voice assistant panel, engagement).

Key files:
- `src/components/FeatureToggles.tsx` supports `variant="bar"`.
- `src/components/ToolsModal.tsx`
- `src/pages/Index.tsx`

## Workflow / commit discipline
- The user requested a "Lovable bot" workflow:
  - After each logical change: `git add .`, `git commit -m "feat|fix: ..."`, `git push origin main`.
- Keep commits granular and event-sourced.

## How to validate quickly
- Local: `npm run lint`, `npm test`, `npm run build`
- Deployed: check console for runtime errors; verify `assets/index-*.js` changes after deploy.

