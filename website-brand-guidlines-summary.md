# Visatop Theme — Brand Guidelines (from code)

## Brand primitives (tokens)
- **Fonts**
  - **Sans (UI/body)**: Inter (`$font_inter`)
  - **Serif (headlines/emphasis)**: Noto Serif (`$font_noto_serif`)
- **Core colors**
  - **Ink (primary text)**: `#012031` (`$color_black`)
  - **White**: `#FFFFFF` (`$color_white`)
  - **Primary blue**: `#224D64` (`$color_blue`)
  - **Blue light**: `#7095A7` (`$color_blue_light`)
  - **Blue light (alt)**: `#375C6F` (`$color_blue_light_2`)
  - **Blue lighten (surface)**: `#F2F9FC` (`$color_blue_lighten`)
  - **Blue lighten (accent)**: `#92C0D7` (`$color_blue_lighten_2`)
  - **Primary yellow (CTA/accent)**: `#FCCD64` (`$color_yellow`)
  - **Yellow hover/light**: `#FFE19F` (`$color_yellow_light`)
  - **Yellow dark (links/hover accent)**: `#CE8E00` (`$color_yellow_dark`)
  - **Neutrals**: `#E7E7E7` / `#E1E1E1` / `#C4C4C4` (light → mid grays)
  - **Error**: `#ff6262` (token) and button red `#ef4444` → hover `#dc2626`

## Typography
- **Base body**: `18px` Inter, `line-height: 1.6`, color ink (`body` in `styles.scss`).
- **Headline style**: Noto Serif, `font-weight: 600`, typical sizes seen across pages:
  - **Hero**: `56px` (mobile often `36px`)
  - **Section headings**: commonly `36px`
  - **Card titles**: commonly `20px`
- **UI/meta text**: Inter, commonly `13–16px` (often uppercase + letter-spacing for dates/meta).

## Layout + spacing (practical rules)
- **Container width**: `max-width: calc(1300px + 3rem)` (`.container`).
- **Responsive breakpoints (max-width)**
  - **Mobile**: `767px` default; sometimes `575px`, `600px`, `782px`, `991px`, `1199px`, `1315px` used as specific cutoffs.
  - **Tablet**: `991px` mixin exists (`@mixin tablet`).
- **Motion**: UI hover transitions are generally **fast and linear** (`0.2s linear`), with occasional `0.3–0.5s ease` for media/card effects.

## Shapes (radii language)
- **Default control radius**: `5px` (buttons + many inputs).
- **Cards/menus/media**: `10–12px` common.
- **Signature “cut-corner” / asymmetric rounding** (brand motif):
  - Examples used repeatedly: `100px 0 100px 0`, `90px 0 90px 0`, `40px 0 40px 0`, `20px 0 20px 0`, `0 0 100px 0`.
  - Use this motif for **hero panels, highlight blocks, major section containers**, and “special” cards.

## Elevation (shadows)
- **Dropdown/menu shadow**: `5px 5px 4px rgba(0,0,0,0.25)` (heavier, directional).
- **Cards**: `0 4px 20px rgba(0,0,0,0.08)` → hover `0 10px 30px rgba(0,0,0,0.12)`.
- **Soft system shadows** also appear (Tailwind-like presets) for some elements.

## Buttons (canonical styles from mixins)
- **Primary button (Yellow)**: `min-width: 148px`, `height: 46px`, radius `5px`, uppercase Inter `16px`, bg **yellow** → hover **yellow light**, text **ink**.
- **Primary alternative (Blue)**: based on Yellow, but `min-width: 200px`, `height: 50px`, Inter `15px` weight `500`, bg **blue** → hover **blue light**, text **white**.
- **Secondary (White)**: white bg, same sizing as Blue; hover flips to **blue** bg with **white** text.
- **Destructive (Red)**: red bg `#ef4444` → hover `#dc2626`, white text.

## Interaction + emphasis patterns
- **Links in nav**: underline indicator uses a **3px yellow bar** on active/hover states.
- **Highlighted text**: `.highlight` uses solid **yellow** background.
- **Overlays**: mobile menu backdrop uses **ink/black** with `opacity: 0.75`.

## What to standardize in a future `design.md`
- **Tokenize the cut-corner radii** into named sizes (e.g. `corner-lg: 100px 0 100px 0`).
- **Define heading scale explicitly** (H1/H2/H3 mapping) so pages stop hardcoding `36px`/`56px`.
- **Define “surface palette”**: when to use `$color_blue_lighten` vs white vs blue.

