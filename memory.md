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
- Arc is now app-scoped via `src/contexts/ArcContext.tsx` instead of page-local.
- Arc now writes centralized debug logs via `src/lib/arcLogger.ts`.
- Wake phrase: "Arc" with aliases (arc/ark/are).
- Wake window: saying "Arc" arms assistant for ~8s; next phrase can omit "Arc".
- Commands supported: start/stop tracking, next/prev slide, capture calibration, open presentation/playground/home, help.
- Freeform questions after wake are sent to Groq and spoken back.
- Arc enablement is persisted in localStorage (`arc-enabled`) so it should stay on across route changes and reloads until user turns it off.
- Arc state machine intent:
  - `idle`
  - `listening`
  - `armed`
  - `executing_command`
  - `querying`
  - `speaking`
  - `error`
- If Arc is armed and no follow-up is spoken before the wake window expires, it should auto-reset back to listening instead of staying armed.
- Transient recognition errors (`no-speech`, `network`, `aborted`) are now treated as recoverable and should not surface as fatal UI error state.
- Fatal recognition errors remain permission/device only (`not-allowed`, `service-not-allowed`, `audio-capture`).
- Arc restart behavior now uses a short backoff on `onend` when still enabled and not speaking.
- Question routing is broader and should answer natural prompts like `which ...`, `can you ...`, `do you know ...`.

Key files:
- `src/contexts/ArcContext.tsx`
  - Owns a single `SpeechRecognition` instance and the Arc state machine
  - Registers page-specific handlers for home/presentation actions
  - Pauses speech recognition while TTS is speaking, then resumes
  - Resets armed/transcript state after commands and queries
- `src/lib/arcLogger.ts`
  - Records `{ state, transcript, action, timestamp, detail }`
  - Exposes logs on `window.__arcLogs` for quick debugging in DevTools
- `src/hooks/useVoiceCommandAssistant.ts`
  - Now mainly provides transcript/intent parsing helpers used by ArcContext
- `src/components/VoiceAssistantPanel.tsx` (detailed status panel shown inside Tools modal)
- `src/pages/Index.tsx` (registers home handlers; includes under-camera Arc toggle chip)
- `src/pages/Presentation.tsx` (registers presentation handlers; uses shared Arc state)

### 5) Spatial Interaction Mode
- New route: `/spatial`
- Provides three modes:
  - `draw`: capture air-writing strokes and commit them into 3D objects
  - `spatial`: manipulate created objects in a 3D scene
  - `solar`: built-in interactive Solar System demo
- Gesture input currently uses hand landmarks + pinch detection:
  - primary pinch -> grab/release
  - two-hand pinch -> scale selected object
  - pointer position is derived from index fingertip
- Draw mode now supports simultaneous drafting from multiple visible hands/index fingers.
- Each stable hand track builds its own draft stroke and committed drawing object.
- Scene supports:
  - orbit / zoom / rotate via camera controls
  - moving planets and drawn objects
  - resetting solar objects to defaults

Key files:
- `src/pages/SpatialStudio.tsx`
- `src/components/SpatialScene.tsx`
- `src/hooks/useSpatialGestures.ts`
- `src/lib/spatialTypes.ts`
- `src/lib/spatialSceneData.ts`

Known limitations:
- Draw-to-object conversion is MVP quality: committed drawings become 3D line objects, not volumetric meshes.
- Scene interaction is stable enough for demo use, but not yet physics-driven or depth-snapped.

Groq backend:
- Vercel function: `api/arc.js`
- Env var on Vercel: `GROQ_KEY`
- Endpoint called from client: `POST /api/arc` with `{ prompt }`

Tests:
- `src/test/voiceAssistant.test.ts` covers normalize/wake parsing/wake window interpreter.

## Current known issue / why this file exists
- The active Arc stabilization refactor is meant to solve:
  - Arc not staying active across pages
  - stale wake state after a command/query
  - self-trigger loops such as repeated "Stopping tracking"
  - getting stuck after answering a Groq question
- Additional fix shipped:
  - idle listening should not drift into `Arc Error` just because the browser emitted transient recognition events
- If `Last heard` stays `-` while mic is on, `SpeechRecognition.onresult` is likely not firing (browser/permission/support issue).
- If Arc still loops after this refactor, inspect whether the browser is re-emitting old final results or whether TTS is still being captured despite the recognition pause.

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
