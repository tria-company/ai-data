# Quick Task 260401-n7s: Fix extractHighlights story image and next button selectors

## Changes

### lib/extraction.ts — `extractHighlights` function

**Bug 1: Story image not detected**
- Old selectors: `img[decoding="sync"], img[style*="object-fit"], img[sizes]`
- Instagram's actual story image: `<img draggable="false" class="xl1xv1r..." src="...">`
- Fix: Added `img[draggable="false"]` as primary selector, with bounding rect size check (> 200x200)

**Bug 2: "Next" button not found**
- Old selector: `button[aria-label="Avançar"]`
- Instagram's actual structure: `<div role="button"><svg aria-label="Avançar"></svg></div>`
- Fix: Added Strategy 2 that finds `svg[aria-label]` and clicks its closest `div[role="button"]`

**Bonus: Better loading**
- Changed `waitUntil` from `domcontentloaded` to `networkidle2` for story pages
- Increased initial delay from 2500ms to 3000ms

## Commit
- `4936dbb` fix: extractHighlights story image and next button selectors
