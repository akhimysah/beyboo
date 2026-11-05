# Alya and Aaron — 2026-11-04

The user renamed Élya to **Alya** and Liam (spelled Lyam in the request) to **Aaron**. Their existing designs, roles, and story arcs remain the same.

Updated the collection cards, full stories, configurator, video labels, campaign captions, product descriptions, accessibility descriptions, app character choices, and server-side voice identities. The screen tool description explicitly maps the new names to the stable `elya` and `liam` keys, preserving previous saved compositions and API compatibility. No live paid voice session was started.

Two visuals contained printed old names. Both now have versioned replacements, used in the catalogue and enlarged galleries. The general collection image is also the Open Graph image.

Final assets:

- `public/assets/universe/merch-hero-alya-aaron.webp`
- `public/assets/universe/stationery-alya-aaron.webp`

Original assets are retained for rollback. Edits used built-in image generation; only final approved outputs are referenced by the site. Conversion to WebP retains the generated dimensions.

## Validation

- 60 existing tests passed, including voice, camera, gaze, profile persistence and app cleanup.
- Syntax and whitespace checks passed for the changed scripts.
- Checked that the front-end and server stories match for both characters and that the voice identity instructions use Alya / Aaron.
- Browser: opened both stories and selected Aaron; the configurator displayed BEYBOO One + Aaron. Both new names appear in the app's character list.
- Inspected portraits and keychain artwork; no names to edit there. An OCR scan of 43 existing catalogue, campaign, usage, country and film-poster visuals found old printed names on the two updated stationery/collection images. Final replacement lettering was visually reviewed.
- Screenshot: `alya-aaron-20261104.jpg`.

## Final image edit prompts

### General collection

Use case: text-localization. Edit target: the attached wide BEYBOO collection product photograph. Make only TWO tiny text edits on the notebook covers in the upper right of the photograph: replace 'Élya' below the doll on the pink notebook with 'Alya' (exact spelling A-l-y-a), and replace 'Liam' on the blue notebook to its right with 'Aaron' (A-a-r-o-n). Match the existing printed font, size, dark ink, perspective and surrounding little dashes. Preserve the whole original wide photograph exactly in every other respect: BEYBOO logo and all other text, framing, objects, placement, bags, plush keychains, phone, bottles, lunchbox and food, notebook dolls, stickers, pencils, ivory/blue/pink colors, textures, lighting, shadows. Do not add, remove, move or redesign anything. The change is only the two printed names. Keep original landscape aspect ratio.

### Stationery

Edit the typography on the FOUR closed notebook covers of this BEYBOO product photograph. Re-typeset each character label in clean simple UPPERCASE sans-serif, printed naturally on the linen. Exact labels from left to right: NOAH, AARON, MILA, ALYA. The pink notebook on the right MUST say ALYA, four plain uppercase Latin letters, no accents at all. Replace the entire old label on that notebook, including its old accent. AARON is the name below the navy-beanie plush on the blue notebook. Keep the thin little horizontal lines beside each name. Preserve the original layout, full composition, products, character plush designs, fabric, colors, background, BEYBOO branding, stickers, pencils, and all other text. Do not change the dolls. Only replace the four printed name labels. The four final printed labels are: NOAH / AARON / MILA / ALYA. No accented letters in any character name.
