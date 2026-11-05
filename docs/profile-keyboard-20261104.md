# Profile and circular keyboard — 2026-11-04

The website and companion app now expose **Mon profil** and **Tester le clavier de l’œil**. **Mon espace** opens this same editor. `?app=1&screen=profile` opens it directly.

The editor uses the existing single 400px logical circular screen. Opening the profile enlarges that screen for typing; the complete stationary plush stays above it. Closing the magnifier places the same live form back inside the plush's eye. No body, mouth or limb animation is introduced.

The AZERTY keyboard supports selection-aware insertion, one-shot shift, digits, punctuation, French accents, space, backspace and next-field navigation. A separate option enables the device's native keyboard. Physical keyboards also work.

Saving validates the name and identifier, normalizes them, and stores only `{version, name, handle}` under `beyboo-profile-v1` in this browser's localStorage. The welcome text reflects the saved name. Invalid edits never overwrite a saved profile. When storage is unavailable the message explicitly says the profile lasts only for this session. Deletion reports storage errors rather than falsely claiming success.

This is a local demonstration profile, not authentication or a reserved username. It does not create a Google, WhatsApp or BEYBOO server account. Names and identifiers are not included in voice tool snapshots or sent to OpenAI. Opening the editor stops active voice and gaze sessions. Other screen activities close the editor through the shared cleanup path.

## Validation

- All 60 Node tests passed, including 5 new storage/validation tests.
- Script syntax checks passed.
- Browser: typed Hicham / beyboo with the virtual keys, saved, reloaded, and verified both fields and the personalized greeting survived.
- Browser: invalid identifier produces an inline error; shift, accent insertion, backspace, digit layout, next-field navigation and native input-mode toggle worked.
- Browser: Mon espace opens the editor; returning to the eye and opening the math activity restores existing screen content.
- Visual review: full plush, circular profile screen and app layout verified. Screenshot: `profile-keyboard-20261104.jpg`.
- No paid voice request, microphone permission or camera permission was used for these checks. Mobile-specific native keyboard display was not tested in this desktop browser.
