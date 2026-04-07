

# Finger String Feature

Add a toggleable "String Art" mode that draws glowing neon strings connecting all 10 fingertips across both hands, creating a cat's cradle / string figure effect.

## How it works
- When enabled and both hands are detected, draw lines connecting all 10 fingertips (landmarks 4, 8, 12, 16, 20 on each hand) to each other — 45 possible connections across both hands, or a subset for a cleaner look (e.g. matching fingers: thumb-to-thumb, index-to-index, etc. plus sequential connections within each hand's tips).
- When only one hand is detected, connect the 5 fingertips of that hand.
- Strings rendered with gradient colors, glow effects, and slight elasticity feel.

## Technical Changes

### 1. Add `fingerString` flag to `FeatureFlags` (`src/components/FeatureToggles.tsx`)
- Add `fingerString: boolean` to the interface
- Add toggle entry with a cable/link icon

### 2. Pass flag into hand tracking draw logic (`src/hooks/useHandTracking.ts`)
- Accept a new `drawStringRef` similar to `drawOverlayRef`
- After drawing hand skeletons, if string mode is on, collect all fingertip positions (indices 4,8,12,16,20) from all detected hands
- Draw connecting lines between all fingertip pairs with rainbow gradient colors and glow

### 3. Wire up in `src/pages/Index.tsx`
- Add `fingerString: true` default to feature flags
- Create `drawStringRef` and pass to `useHandTracking`

### Files
- **Edit**: `src/components/FeatureToggles.tsx` — add toggle
- **Edit**: `src/hooks/useHandTracking.ts` — draw string connections between fingertips
- **Edit**: `src/pages/Index.tsx` — wire up new flag

