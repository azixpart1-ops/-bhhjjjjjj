# Lunova design pass, October 2026

A pass over the theme's shared design system against the TypeUI design skills
added to this workspace: the **terracotta** style from `typeui-design-styles`,
the visual rules in `typeui-fundamentals-visual` and the interaction and
accessibility rules in `typeui-fundamentals-interaction`. The brief for the pass
was the skills' own order of work: design system first, then spacing, then
hierarchy and typography, with accessibility winning every conflict.

Nothing in this pass changes copy, prices, claims or any purchase flow. It
changes the shared tokens and component classes in `theme/assets/base.css`, the
supporting text size in every stylesheet, one spacing default, and the class a
page title uses. The October mobile audit build stays the base.

## 1. Style: terracotta

Of the 67 styles in the registry, `terracotta` is the one PawLunova already is:
"warm cream surfaces, ink-brown headlines set in a display serif, and a single
terracotta accent ... content-first, tuned for readability and visual rhythm."
The pass keeps the brand tokens the store owns and applies the style's rules.

| Terracotta token | Theme token | Decision |
|---|---|---|
| primary `#C56A3C` | accent `#B4532A` | **Kept the theme's.** `#C56A3C` on white is 3.82:1 and on bone 3.54:1, under the 4.5:1 the skill requires for button labels. The interaction skill's own rule applies: fix a failing brand colour along its own hue. `#B4532A` is that fix (4.99:1 on white, 4.63:1 on bone). |
| secondary `#F3E9D8` | oat `#F1E9DB` | Kept the theme's. Same tone within a point of lightness. |
| display serif, DM Serif Display | Playfair Display (theme setting) | Kept. The typeface is a brand parameter the owner chose in theme settings, and the TypeUI skill says brand kit values stay the brand's. A merchant can switch it under Theme settings → Typography. |
| 44px+ touch targets, visible focus, high-contrast support | already in the theme | Unchanged. |

## 2. What changed, rule by rule

Each row names the rule from the skill, what the theme did before, and what it
does now. "Visual §" and "Interaction §" refer to the two fundamentals skills.

| Rule | Before | Now |
|---|---|---|
| Visual §1: marketing and e-commerce content width is 1280px, one shared container token | `page_width` defaulted to 1320px | Default 1280px (`--page-width`), with 1280px added to the Page width setting. The store's saved setting is moved too (`settings_data.json`). |
| Visual §9: display headings (28px and up) use `line-height: 1`; smaller headings 1.1 to 1.25 | `.h0` 1.04, h1 1.08, h2 1.12, h3 1.2, h4 1.3 | `.h0`, h1, h2 at 1; h3 1.15; h4 1.25; base heading leading 1.2. |
| Visual §2 and §9: a heading followed by its paragraph has 32px below it, set on the heading's side | Section heads used a 10px stack gap; the hero used 18px | `:is(.h0, .h1, .h2, h1, h2) + :is(p, .lede, .rte)` gets `margin-block-start: 2rem`. Eyebrow to heading stays tight. |
| Visual §2: section header area to content is 48 to 64px | `.section-head` 24 to 40px | `clamp(2rem, 1.25rem + 2.5vw, 3.5rem)`: 32px on a phone, 52px at 1280, 56px at 1440. |
| Visual §1: sticky nav, hero top padding = nav height + 96px | Hero `padding_top` 32px | 96px on desktop (schema default and `templates/index.json`). The header is sticky and in flow, so the 96px is the hero's own top padding under it. |
| Visual §2: scale section padding down on a phone, keep the tiers | Phones got 70% of the desktop value, uncapped (hero would have been 67px) | 70% capped at 48px, the loose tier (`snippets/section-styles.liquid`). Compensating control for the hero rule above: at 390×844 the hero's primary button still sits in the first screen (about 40px lower than before, with the secondary button now fully inside it as well). |
| Visual §9: minimum 14px for supporting text; below 14px only for micro UI | 98 declarations at 13px (`0.8125rem`): hints, errors, card meta, delivery lines, trust sub-lines, the eyebrow, `.xsmall` | All at 14px (`0.875rem`). Badges, sale pills and spec chips stay at 12px as micro UI. |
| Visual §1 and §9: button labels never wrap, buttons never shrink | `.btn` `white-space: normal` | `white-space: nowrap; flex-shrink: 0`. The one label that then clipped (the Bed Finder tile's "Find their bed" in a 138px tile at 320px) drops its arrow and tightens its padding under a container query instead of wrapping. |
| Visual §9: button labels are never underlined; Interaction §4: a button is recognisable at rest, never revealed by hover | `.btn--ghost` was an underlined text button | A tertiary "soft" button: 7% ink tint at rest, 12% on hover (technique H4), 18% when pressed (A6), no border, no underline. Primary (fill), secondary (outline), ghost (tint) now differ by variant, not by size. |
| Interaction §4: button transitions 100 to 200ms | Box-shadow on buttons at 240ms | 150ms (`--dur-fast`) for every button property. |
| Visual §1: native selects reset in all three engines, custom chevron at the icon inset, trailing padding = inset + icon + inset | `-moz-appearance` missing; trailing padding 44px for a 16px chevron at a 16px inset | `-moz-appearance: none` added; `padding-inline-end: 3rem` (16 + 16 + 16). |
| Visual §1: nested radius = outer radius − padding | `.card` had no rule for media inside it | `.card` exposes `--card-pad`; `.media` directly inside a card gets `max(4px, radius − padding)`. |
| Visual §1: inset videos get a visible frame with a system shadow | Rounded, no shadow | `.video-section__frame` carries `--shadow-md`. |
| Visual §1 and §9: outside the storefront hero, e-commerce page titles (PDP, basket, search, account, 404 and the rest) are capped at 28px; display sizes belong to the hero and section openers | Product title, basket, search, account, blog, article, contact, page, 404, list-collections and the finder page used `.h1` or `.h2` (28 to 56px) | A role class `.heading-page` (24 to 28px, `--lg` a flat 28px) on every one of those titles (twenty headings across eighteen sections, plus the product buy box). The product buy box maps its Heading size setting onto it: Large = 28px, Medium = 24 to 28px, Small = the card scale; the quick-add drawer uses a dialog title size. The collection hero keeps its display size, as the skill allows for a storefront collection hero. On the product page the buy button moves about 57px up the screen at 1440. |

### Already in place, checked and left alone

- Focus: 2px ring in the ground's text colour with a 2px offset band, on every control (Interaction §5).
- Touch targets 44px with 8px between them; `scroll-padding-top` on the root; skip link first in the tab order.
- One `h1` per page; `h3` on product cards, `summary` on FAQ questions, no `h2` or `h3` inside repeating components.
- Inputs lighter than their ground with a 3:1 border; input and button in the newsletter row share a 48px height and 1.5px border.
- Real SVG icons from one family (`snippets/icon.liquid`); badges inline and content-sized; `text-wrap: balance` on headings and `pretty` on paragraphs.
- Hover only under `(hover: hover) and (pointer: fine)`; reduced motion collapses movement to cross-fades.
- Contrast on the real grounds: ink on bone 16.9:1, muted on bone 6.9:1, muted on oat 6.2:1, accent button text 4.99:1.

## 3. Deviations, with the reason and the compensating control

1. **Hero top padding on phones is 48px, not 96px.** The skill's hero rule is written for the desktop nav; its spacing rule says to scale section padding down on a phone and keep the tiers. 48px is the loose tier. Checked: the primary call to action stays in the first screen at 390×844.
2. **Accent colour and display typeface differ from the terracotta entry.** The entry's primary fails AA on a button; the theme's accent is the same hue corrected for contrast. The typeface is a brand setting the owner controls.
3. **The collection hero title keeps a display size.** The skill lists the storefront collection hero among the surfaces allowed the display scale.
4. **The eyebrow stays a 14px uppercase label with 0.12em tracking.** The skill allows 14px for a group label only as uppercase with tracking, which is what the eyebrow is.

## 4. QA checklist (run before shipping any later change to these files)

- [ ] `cd scripts/theme-dev && node check.mjs --no-theme-check` → `PASS`, no `[contract]` warning on `page_width`.
- [ ] `node browser-test.mjs --no-matrix` → `PASS` (28 pages at 1440 and 390, purchase flows, axe at 390).
- [ ] At 320px and 360px no `.btn` clips its label or leaves its parent (the Bed Finder tile, product cards, sticky bar, basket).
- [ ] Hero at 1440: heading set solid, 32px to the lede, 96px under the header. At 390: primary button inside the first screen.
- [ ] Every page title outside the home and collection heroes is 28px or less at 1440; product buy button sits above the fold at 1440.
- [ ] No `font-size` under `0.875rem` outside `.badge`, `.price__save`, `.product-card__spec` and other pills.
- [ ] Ghost buttons show a tint at rest; no button is underlined in any state.
- [ ] `<select>` draws the theme chevron in Chromium, Firefox and Safari, text never under it.

## 5. How this pass was verified

- Harness static and render checks, before and after: `errors=0`, 15 warnings, identical lists.
- Full browser run after the change: 107 checks passed (page sweep at 1440 and 390, purchase flows, offer and delivery-date flows, axe WCAG 2.2 A/AA at 390).
- A narrow-viewport probe at 320px and 360px over home, three product pages, the collection, basket, FAQ, finder page and search: no horizontal scroll, no clipped button label. The probe's only flags are the same two false positives the baseline shows (the off-canvas filter panel, and quick-add buttons whose visually-hidden product name reports a wider scroll box).
- Above-the-fold screenshots at 1440×900 and 390×844 compared with the baseline for home, product, collection, basket and search.
