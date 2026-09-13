# OpenCode Turn Stats Design System

## 1. Atmosphere and identity

The plugin should feel native and almost invisible. Its signature is one quiet
fact placed beside OpenCode's own sidebar information.

## 2. Colour

Use only the active OpenCode theme. The label uses `textMuted`; the value uses
`text`. Do not add status colours, backgrounds, borders, or raw colour values.

## 3. Typography

Inherit OpenTUI text rendering. Use plain text with no custom size, weight, or
font. Render the literal label `This turn` and a compact token count followed by
`processed`.

## 4. Spacing and layout

Register in `sidebar_content` at order 150. Let the host own outer spacing. The
row is a two-part horizontal layout: a fixed label and a wrapping value. It must
fit a 30-column sidebar without horizontal scrolling.

## 5. Components

### Turn row

- Structure: one row with a muted label and normal value.
- Variants: none.
- States: present when the count is supported; absent otherwise.
- Accessibility: non-interactive text with no colour-only meaning.
- Motion: none.
- Layout: a wrapping row in the host-owned sidebar scroll region.

## 6. Motion and interaction

There is no interaction or motion. Mouse and keyboard input must not change the
row.

## 7. Depth and surface

Use the host surface. Add no depth, border, shadow, fill, or separate panel.

## 8. Accessibility constraints and accepted debt

The row follows the host theme's contrast and terminal reflow. It has no focus
target because it has no action. There is no accepted visual debt.
