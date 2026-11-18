# Silhouette Shader

Twelve original procedural light studies for Moonshine. The sun's position at a chosen location, date, and time controls the light's direction, warmth, and intensity.

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

## Use the component

`src/SilhouetteShader.tsx` is a client component. It uses `createFullscreenFragment` from `@tschk/moonshine-next/shaders`, compiles one original GLSL program, and updates its uniforms without recompilation. The studio's HTTP server uses Moonshine. There is no Next.js runtime dependency.

Import the component and the stylesheet into a Moonshine React app. These source modules are the integration files, not a published npm package.

```tsx
import { SilhouetteShader } from "./src/SilhouetteShader";
import "./src/style.css";

<SilhouetteShader
	scene="bough"
	instant={new Date("2024-12-21T04:00:00Z")}
	latitude={22.3193}
	longitude={114.1694}
	facing={135}
	overcast={false}
/>
```

The stylesheet makes the canvas full-screen. For an embedded canvas, override `.light-canvas` with the desired dimensions and positioning. `scene` is a typed scene ID. `instant` is a UTC instant, not a local-time string. Latitude is north-positive; longitude is east-positive. `facing` is a clockwise bearing from true north. Direct light disappears when the sun is behind the window. `paused` freezes only the material animation.

For custom renderers, `src/shader.ts` exports the fragment body `silhouetteFragment`. Its uniforms are `u_resolution` in pixels, `u_time` in seconds, `u_scene` as the scene's zero-based catalog index, `u_elevation`, `u_azimuth`, and `u_facing` in radians, and `u_overcast` from 0 to 1.

The canvas caps pixel density at 1.5 and drawing at approximately 30 frames per second. It stops drawing in hidden tabs. Reduced-motion preferences freeze the material animation. A WebGL failure or context loss produces a visible recovery message instead of silently showing a blank canvas.

## Solar model

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

`PREVIEW_URL` overrides the target. `EVIDENCE_DIR` overrides the output directory. The default is `.amp/in/orb-backup/browser-check`. The check uses Chromium software WebGL, verifies twelve different rendered images, checks solar values and controls, compares day, night, and overcast pixels, and checks 1280, 768, and 390-pixel layouts. Narrow Chromium layouts are not physical-device tests.

## Hosting

`dist/` is a static site after the build. `bun start` serves it through Moonshine. No production host or custom domain is configured.

## License

ISC. All scene code is original. Runtime dependencies use permissive licenses.
