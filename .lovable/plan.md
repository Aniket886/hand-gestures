

# Gamified Gesture Playground

## Overview
Add a new `/play` page with interactive mini-games controlled by hand gestures via the webcam. The page reuses the existing hand tracking hook and gesture detection system.

## Games

1. **Bubble Pop** — Colored bubbles float up the screen. Point at them (index finger tip position) to pop them. Score tracks pops.
2. **Gesture Match** — A random gesture emoji/name appears; perform it within a time limit to score. Streak bonus for consecutive matches.
3. **Catch the Star** — A star appears at random positions. Move your open palm to the star's location to catch it. Tracks reaction time.

## Technical Plan

### 1. Create `/play` route and page (`src/pages/PlayCanvas.tsx`)
- Webcam + canvas refs (same pattern as Index)
- `useHandTracking` hook for gesture/hand detection
- Game mode selector (Bubble Pop / Gesture Match / Catch Star)
- Shared score display, timer, and game state management
- Back button to home

### 2. Game components (`src/components/games/`)
- **BubblePop.tsx** — Renders bubbles as animated divs. Uses `writingTip` (finger position) to detect collision. Bubbles spawn at intervals, float upward. Pop animation on hit.
- **GestureMatch.tsx** — Shows target gesture from mappings list. Compares `gesture.gesture` to target. Timer countdown. Score + streak counter.
- **CatchStar.tsx** — Renders star at random position. Uses normalized hand landmark (palm center) for proximity check. Spawns new star on catch.

### 3. Add route in `App.tsx`
- `/play` → `PlayCanvas`

### 4. Add nav link on Index page
- "Play" button in header next to "Present"

### Files to create/edit
- **Create**: `src/pages/PlayCanvas.tsx`, `src/components/games/BubblePop.tsx`, `src/components/games/GestureMatch.tsx`, `src/components/games/CatchStar.tsx`
- **Edit**: `src/App.tsx` (add route), `src/pages/Index.tsx` (add Play nav link)

