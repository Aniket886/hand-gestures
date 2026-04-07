

# Add Distance Measurement to Finger Strings

## What it does
When the finger string feature is active, display the distance in centimeters between each pair of connected fingertips, rendered as a label on the string line.

## How distance is estimated
MediaPipe provides normalized hand landmarks (0-1). The distance between the wrist (landmark 0) and the middle finger MCP (landmark 9) is roughly **8-9 cm** on an average adult hand. We use this as a real-world reference to convert pixel distances to centimeters:

1. Calculate the wrist-to-MCP pixel distance as a calibration reference (~8.5 cm)
2. For each string between two fingertips, compute pixel distance and convert using the calibration ratio
3. Display the cm value as a label at the midpoint of each string

## Changes

### 1. `src/hooks/useHandTracking.ts`
In the finger string drawing section (lines 259-291):
- Before drawing strings, compute the calibration scale from the first hand's wrist (landmark 0) to middle MCP (landmark 9) pixel distance, mapping it to ~8.5 cm
- After drawing each string line between two tips, calculate the pixel distance, convert to cm, and draw a text label at the midpoint showing e.g. "4.2 cm"
- Style: small white text with dark background pill for readability

### 2. `src/hooks/useHandTracking.ts` (state)
- Add `stringMeasurements: { from: number; to: number; cm: number }[]` to `HandTrackingState` so the UI could optionally display measurements outside the canvas
- Expose in state update

### Files
- **Edit**: `src/hooks/useHandTracking.ts` — add distance calculation and text rendering in the string drawing loop

