# BEYBOO — Turkey edition and new media

## Added

- The user's 10.04-second, 1550 × 512 H.264 brand animation is placed below the homepage introduction. It uses the existing player, with controls outside the picture, no autoplay, and a lightweight poster. The film animates the BEYBOO wordmark, not a plush body.
- The previously generated CarPlay-inspired circular launcher visual is shown complete below the live product demo, on both the website and the companion application. The image opens in the existing accessible gallery. Its caption distinguishes the visual concept from actual integrations.
- A new Turkey concept edition features Rayan in red and ivory, with crescent/star details and a hazel digital eye with visible white sclera. The full plush is visible and physically stationary. It is the first of twelve World posters, available under both Europe and Asia filters.

## Source media

- User video: `_users_498ec938-f4be-46af-9c87-668749a2c2f4_generated_2c12deb8-508a-45a7-9098-e8cf45a2f11b_generated_video.mp4`.
- Existing interface image: `exec-002da857-21d9-4731-ae57-46bcd2021b48.png` (1536 × 1024).
- Generated Turkey image: `exec-1dee0405-5432-4234-a45e-b4ea73d7a231.png` (1122 × 1402), visually matched to the Morocco and England posters. Full composition retained in WebP export.

## Validation

- 55 existing automated tests passed; modified JavaScript syntax checks and Git whitespace checks passed.
- Browser preview: brand video played to completion (10.04 s), no media error, controls' top edge exactly aligned with video bottom (no overlay).
- World count is 12; Asia filter returns Turkey, Europe returns 4 editions including Turkey. Turkey gallery opens at 1 / 12 with the whole poster visible.
- Interface visual opens full and uncropped, with disabled gallery pagination for its single-image group.
- Companion application navigation confirms the new visual is present below the functional demo.
- Browser proof: `docs/media-20261104/turquie-gallery.jpg`.

Existing live eye, gaze, voice, call, camera, and media behavior were not changed. No microphone/camera or paid voice session was activated for these checks.
