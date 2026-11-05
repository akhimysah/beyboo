# Live gaze on the main BEYBOO eye

`public/gaze.js` reuses the existing same-origin face detector Worker. It does not load a recognition model, create a face identity, record the camera, or send frames or coordinates to an API. The browser requests video only, so an existing voice conversation keeps its own microphone.

## UI integration

- Load `gaze.css` and `gaze.js` with the existing camera and detector scripts.
- Start only from an explicit button or launcher action: `await window.BeybooGaze.start()`.
- `isActive()` includes permission and model loading; a second touch can call `stop()` immediately.
- `recenter()` makes the latest tracked head position the neutral point and returns `false` when no recent face is available.
- Listen for `beyboo-gaze-state`. Its entire payload is `{ state, message }`. States are `off`, `requesting`, `loading`, `searching`, `tracking`, `error`.
- The `gaze-active` class and percentage variables `--gaze-x` / `--gaze-y` belong to `#living-eye`. Apply them only to `.voice-iris-motion`. Never transform the plush photograph, body, entire eye or rim. Suppress decorative voice X/Y drift while gaze is active; audio glow/scale can remain.
- Start a Jitsi call only after stopping gaze. Starting the photo camera already stops gaze. Starting gaze calls `BeybooCamera.leave()` to release the photo stream.
- Ordinary screen changes must not call gaze.stop: an explicitly active session continues while the user watches a video, but gaze variables render as zero whenever the eye is hidden. Page hiding or leaving stops and releases everything.

## Tracking behavior

The first valid face establishes the neutral position. The front camera is mirrored horizontally; the rear camera is not. Consecutive detections choose the closest plausible box rather than repeatedly switching to the largest bystander. This is spatial continuity, not identification. Movement is bounded to ±7% horizontally and ±5.5% vertically and smoothed between detections. After 1.1 seconds without a current face, the pupil returns to its center without invented movement. After 1.8 seconds the spatial lock is released and a new face can establish a new neutral point.

One inference runs at a time on 320-pixel analysis frames using the existing CPU Worker. Performance depends on the phone and lighting; the animation interpolates actual detection updates rather than claiming camera-rate inference. The Worker and local model files were already part of the project.

## Verification

Run `node --test tests/gaze.test.mjs tests/camera.test.mjs`. These tests cover permission gating, video-only requests, camera handoff, mirror direction, vertical movement, limits, smoothing, multiple faces, loss and stalled frames, calibration, screen hiding, pending permission/model/inference cancellation, track interruption and background cleanup. They do not replace a real-camera check on an iPhone and an Android device.

Manual check: open the site or app over HTTPS, select the gaze action, allow the camera, wait for “Je te vois”, then move the head left/right/up/down while keeping the plush body visible. Start talking without stopping gaze; the pupil should follow the head and the voice signal should still react. Leave the camera frame and verify recentering. Open Photo and then a call; verify no second camera remains active. Background the page and verify that its camera indicator turns off. Repeat with denied permission and with reduced-motion enabled.

## Primary references consulted

- [MDN: getUserMedia, permissions and video constraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: stop every MediaStreamTrack and clear srcObject](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop)
- [face-api.js: Tiny Face Detector and local model loading](https://github.com/justadudewhohacks/face-api.js)
