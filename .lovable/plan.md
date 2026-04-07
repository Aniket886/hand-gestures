

# Fix Finger Strings: Only Connect Extended Fingers

## Problem
Currently, strings connect all fingertips regardless of whether fingers are open or closed (fist). Strings should only draw between fingers that are visibly extended.

## Change

**Edit**: `src/hooks/useHandTracking.ts` — lines 221-249

Filter fingertips before drawing strings. For each hand, use the existing `isFingerUp` function to check each finger. For the thumb, check landmark 4 vs 3 vs 0. Only include tips of extended fingers in the `allTips` array.

Finger-to-landmark mapping for `isFingerUp(landmarks, tip, pip, wrist)`:
- Thumb: special check (tip 4 vs IP 3, compare x-distance based on handedness)
- Index: `isFingerUp(lm, 8, 6, 0)`
- Middle: `isFingerUp(lm, 12, 10, 0)`
- Ring: `isFingerUp(lm, 16, 14, 0)`
- Pinky: `isFingerUp(lm, 20, 18, 0)`

Only add a fingertip to `allTips` if its finger is extended. If fewer than 2 tips are extended across all hands, skip drawing entirely.

### Files
- **Edit**: `src/hooks/useHandTracking.ts`

