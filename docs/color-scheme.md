# ESV Color Scheme

Source: ESV brand identity palette (see `earlyseed_ventures_brand_guidelines.md` §5.2 for the full
brand rationale, typography, and logo rules). This file is the **developer-facing** companion —
it maps each named brand color to the actual CSS variable in `src/app/globals.css`, so "use the
golden glow color" means something concrete in code.

## Palette

### Primary palette

| Name | Hex | CMYK |
| :--- | :--- | :--- |
| Crema | `#F7ECE2` | C2 M6 Y9 K0 |
| Fair | `#F4F4F4` | C3 M2 Y2 K0 |
| Slate | `#A39B95` | C38 M35 Y38 K1 |
| Sand | `#D3C1A9` | C18 M21 Y33 K0 |
| Bronze | `#D5AE8F` | C16 M32 Y44 K0 |
| Golden Glow | `#CB8C7C` | C20 M50 Y48 K1 |

### Accent hues

| Name | Hex | CMYK |
| :--- | :--- | :--- |
| Pastel Purple | `#CEAAFD` | C22 M34 Y0 K0 |
| Purple | `#745FFD` | C67 M67 Y0 K0 |

Accent hues never touch the logo itself — see the brand guidelines doc.

## Mapped to CSS variables (`src/app/globals.css`)

| CSS variable | Light mode | Dark mode | Palette color | Typical use |
| :--- | :--- | :--- | :--- | :--- |
| `--color-bg` | `#F7ECE2` | `#1A1A2E` | Crema (light) / Deep Navy (dark, off-palette) | Page background |
| `--color-card` | `#F4F4F4` | `#22223A` | Fair (light) / Dark Raised (dark, off-palette) | Card surface |
| `--color-card-raised` | `#FFFFFF` | `#2A2A44` | — | Elevated card surface |
| `--color-text` | `#2C2C3A` | `#F0EDE8` | — | Body text |
| `--color-muted` | `#A39B95` | `#A39B95` | Slate | Secondary/muted text |
| `--color-border` | `#D3C1A9` | `#3A3A5C` | Sand (light) / Dark Border (dark, off-palette) | Borders, dividers |
| `--color-primary` | `#745FFD` | `#745FFD` | Purple | Primary actions, active states |
| `--color-primary-light` | `#CEAAFD` | `#CEAAFD` | Pastel Purple | Hover states, tags |
| `--color-accent` | `#D5AE8F` | `#D5AE8F` | Bronze | Franchise/warm-accent tags |
| `--color-warning` | `#CB8C7C` | `#CB8C7C` | **Golden Glow** | Warnings, overdue states, sidebar section headers |
| `--color-destructive` | `#C0392B` | `#E74C3C` | — (not in brand palette) | Errors, delete actions |
| `--color-success` | `#2E7D32` | `#66BB6A` | — (not in brand palette) | Success states |

Notes:
- `--color-warning` **is** Golden Glow — same hex in both themes, so anything styled with
  `var(--color-warning)` is theme-safe without extra overrides.
- `--color-bg`, `--color-card`, and `--color-border` diverge from the earthy palette in dark mode
  (Deep Navy / Dark Raised / Dark Border) since the brand palette itself is light-mode-only —
  dark mode is a separate, deliberately-designed complement, not a literal palette color.
- Always reference the CSS variable (`var(--color-warning)`, etc.) in component styles, never the
  raw hex — that's what keeps light/dark mode consistent app-wide.
