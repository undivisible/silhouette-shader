# Silhouette Shader

## Experience

The procedural canvas occupies the viewport. A warm paper studio holds the scene catalog and settings. A separate time strip leaves the centre of the work unobstructed. On narrow screens the canvas leads, followed by the same controls in document flow.

## Tokens

- Paper: `#f0ece2`
- Ink: `#302a23`
- Secondary ink: `#71685c`
- Selected controls: `#795137` with `#fff8e9` text
- Focus and selection: `#845232`
- Headings: Georgia, with a Times New Roman fallback
- Controls: Helvetica Neue, with an Arial fallback
- Control radius: 2px; studio radius: 4px
- Desktop spacing: 34px outside edge, 21–25px within panels

## States

The scene's selected button uses a filled brown background. Controls retain visible keyboard focus. Solar phase labels come from elevation, not clock-hour ranges. Scene descriptions and the canvas's accessible name change with the selection. Error messages explain invalid civil times, invalid locations, and unavailable graphics.

## Motion

Only the material moves: foliage, caustics, reflected light, and rain. The sun advances with the chosen UTC instant. Still air and reduced-motion preferences freeze material motion. UI transitions are limited to control colour and switch position.
