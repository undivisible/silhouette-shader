# Silhouette Shader

Sixteen original procedural light studies for Moonshine. The sun's position at a chosen location, date, and time controls the light's direction, warmth, and intensity.

[Explore the live studio](https://silhouette.undivisible.dev/).

A web shader inspired by the visual effects of [Sunstill](https://sunstill.app/), an exceptionally well-made desktop app. [Buy the original](https://sunstill.app/) to support its creator. Not affiliated with Sunstill.

## Install

```sh
npm install @undivisible/silhouette-shader@0.1.0
```

The package is ESM. The root entry uses Moonshine's `@tschk/moonshine-next/shaders` renderer. You can use it in a browser app without React, a Moonshine server, or Next.js.

## Mount a room in the browser

Give the canvas a size in CSS. The renderer sizes its drawing buffer to match. No studio stylesheet or image assets are required.

```html
<canvas id="room" style="display: block; width: 100%; height: 24rem" aria-label="Window light"></canvas>
```

Mount only after the canvas exists in the browser. Both mount functions require WebGL 2 and throw if it is unavailable.

```ts
import { mountRoom, type RoomOptions } from '@undivisible/silhouette-shader';

const canvas = document.querySelector<HTMLCanvasElement>('#room')!;
const state: RoomOptions = {
	scene: 'washi',
	instant: new Date('2024-12-21T04:00:00Z'),
	latitude: 22.3193,
	longitude: 114.1694,
	facing: 135,
	onError: (message) => console.error(message),
};
const room = mountRoom(canvas, 'clear', state);

// When the forecast changes, keep the same location, time, and error handler.
room.update('rain', { ...state, scene: 'slats' });

// When the host removes or reuses the canvas:
room.dispose();
```

`update(condition, options)` replaces the **complete state** without recompiling the shader. It does not merge a patch. Omitted options revert to defaults. Without a location or instant, the renderer uses Kuala Lumpur and the current time. `facing` is a clockwise bearing in degrees from true north. Latitude is north-positive and longitude is east-positive.

If the host only needs setup and cleanup, use `mountWeather` instead of `mountRoom`. It takes the same arguments but returns the cleanup function directly:

```ts
import { mountWeather } from '@undivisible/silhouette-shader';

const dispose = mountWeather(canvas, 'fog', state);
// On teardown:
dispose();
```

The host supplies the weather condition. The package does not call a forecast service. Setting `animated: false` or enabling reduced motion paints on mount, update, and resize without a continuous animation loop. Hidden tabs stop scheduling frames. Use `onError` to report WebGL context loss.

## Package exports

- `mountRoom` and `mountWeather` render onto a canvas.
- `scenes` is the catalog of light studies below. `conditions` lists `clear`, `cloud`, `fog`, `rain`, `storm`, and `snow`.
- `solarPosition`, `localClock`, `zonedDateTime`, and `solarDay` are available without mounting a renderer. See [Solar calculations](#solar-calculations).
- TypeScript hosts can import `SceneId`, `WeatherCondition`, `RoomOptions`, and `SolarDay` as types from the root.
- `silhouetteFragment` is the GLSL fragment body for custom renderers. The fragment alone does not generate the moving leaf-shadow and water-height textures. Both mount functions supply them.

## Use the optional React component

In a React app, including a Moonshine React app, import the client component from `@undivisible/silhouette-shader/react`. Size its `.light-canvas` in your own CSS. The component mounts after render, updates when its props change, disposes on unmount, and displays graphics errors.

```tsx
'use client';

import { SilhouetteShader } from '@undivisible/silhouette-shader/react';

export function WindowLight() {
	return <SilhouetteShader scene="bough" weather="clear"
		instant={new Date('2024-12-21T04:00:00Z')}
		latitude={22.3193} longitude={114.1694} facing={135} />;
}
```

```css
.light-canvas { display: block; width: 100%; height: 24rem; }
```

Set `paused` to freeze the material animation while still allowing a new `instant` to change the light.

## Run the studio

Requires Bun and a browser with WebGL 2.

```sh
bun install --frozen-lockfile
bun run build
bun start
```

The server listens on port 3000, or `PORT` when set. Run `bun run build` after editing client code. `bun dev` builds the client once and watches the server.

The studio starts at the current time in Hong Kong. Scrub the time slider to explore a different moment. This switches off **Follow the sun**. Switch it on again to return to the real date and time at the selected place.

**Overcast** attenuates direct light. **Still air** freezes material motion without freezing the solar clock. **Sun & window** exposes the solar bearing and a window-facing control. **Just the light** hides the controls; Escape restores them. Custom locations use decimal coordinates and an IANA timezone.

## Light studies

| Scene ID | Name | Study |
| --- | --- | --- |
| `bough` | Bough | Leaf shadows through a clear window |
| `slats` | Slats | Blinds, foliage, and suspended cords |
| `spectrum` | Spectrum | A dispersed spectrum beside a window |
| `pendant` | Pendant | Colour scattered by hanging glass |
| `vault` | Vault | An arched opening in terracotta |
| `canopy` | Canopy | Moving leaf-filtered light |
| `shallows` | Shallows | Underwater caustics |
| `rain` | Rain | Droplets and trails on glass |
| `foil` | Foil | Copper-coloured reflected ribbons |
| `opal` | Opal | Translucent coloured panes |
| `trellis` | Trellis | Diamond lattice shadows |
| `washi` | Washi | A paper and timber screen |
| `cast` | Cast | Mottled transmission through cast glass blocks |
| `oculus` | Oculus | Palm shadows across a round aperture |
| `clerestory` | Clerestory | Ferns behind a high strip of glass |
| `louvre` | Louvre | A pair of amber timber shutters |

## Solar calculations

`src/solar.ts` computes a low-order apparent solar ephemeris with a topocentric parallax correction. Azimuth is clockwise from true north. Elevation is the geometric solar-centre altitude without atmospheric refraction. The model is intended for 1900–2100, not navigation or surveying.

Civil time uses the supplied IANA timezone, independent of the browser's timezone. Nonexistent DST times throw an error. Repeated times choose the earlier instant. Sunrise and sunset use the conventional −0.833° centre altitude. Events belong to the selected local date, including days that are shorter or longer than 24 hours. Polar day, polar night, and single-event transition dates remain distinct.

There is no terrain, observer-height, building, or weather-dependent refraction model. The shaders are artistic projections driven by the astronomical sun, not an architectural ray tracer. Overcast is a manual visual setting, not a weather forecast. No location or rendering data leaves the browser.

## Verify

```sh
bun run check
TZ=Pacific/Honolulu bun test
```

The solar tests compare fixed expected values from the published [NREL solar-position worked example](https://docs.nlr.gov/docs/fy08osti/34302.pdf) and an independent Moshier ephemeris evaluated with pyswisseph 2.10.3.2. The application has no astronomy-library dependency. Tests cover solstices in both hemispheres, east and west longitude, leap dates, date rollover, fractional-hour timezones, DST gaps and folds, polar conditions, and horizon transitions.

For the rendered check, install `agent-browser`, Chromium, and ImageMagick, start the studio, and run:

```sh
bun scripts/verify-browser.mjs
```

`PREVIEW_URL` overrides the target. `EVIDENCE_DIR` overrides the output directory. The default is `.amp/in/orb-backup/browser-check`. The check uses Chromium software WebGL, verifies sixteen different rendered images, checks solar values and controls, compares day, night, and overcast pixels, and checks 1280, 768, and 390-pixel layouts. Narrow Chromium layouts are not physical-device tests.

## Hosting

`dist/` is a static site after the studio build. `bun start` serves it through Moonshine.

## License

[ISC](LICENSE). All scene code is original. Runtime dependencies use permissive licenses.
