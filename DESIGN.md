# Silhouette Shader

## Experience

The procedural canvas occupies the viewport. A translucent panel at the right holds a miniature of the live frame, time controls, a four-column catalog of rendered thumbnails, and settings. On narrow screens the canvas leads, followed by controls in document flow.

## Tokens

- Paper: `#eaeae4`; ink: `#252722`; secondary ink: `#50554d`.
- Selected controls: `#435346`. Keyboard focus: `#894722`.
- Display text: self-hosted Geist Serif Regular. Small control labels: system sans-serif.
- The 320px desktop rail reserves space for the controls. A translucent surface groups them without blurring the canvas. Increased contrast or reduced transparency makes the surface opaque.

## States

An outline around the thumbnail identifies the selected study. Controls retain visible keyboard focus. Solar phase labels come from elevation, not clock-hour ranges. The canvas's accessible name changes with the selection. Error messages explain invalid civil times, invalid locations, and unavailable graphics.

## Motion

Material motion and the solar clock are independent. Still air and reduced motion freeze material motion. Scene changes and large clock seeks dissolve from the displayed frame. Immersive mode fades the controls and expands the canvas; reduced motion skips these transitions.
