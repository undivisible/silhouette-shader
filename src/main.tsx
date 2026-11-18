import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { SilhouetteShader } from "./SilhouetteShader";
import { scenes } from "./scenes";
import { localClock, solarDay, solarPosition, zonedDateTime } from "./solar";

const places = [
  { name: "Hong Kong", latitude: 22.3193, longitude: 114.1694, timeZone: "Asia/Hong_Kong" },
  { name: "London", latitude: 51.5074, longitude: -.1278, timeZone: "Europe/London" },
  { name: "New York", latitude: 40.7128, longitude: -74.006, timeZone: "America/New_York" },
  { name: "Kyoto", latitude: 35.0116, longitude: 135.7681, timeZone: "Asia/Tokyo" },
  { name: "Sydney", latitude: -33.8688, longitude: 151.2093, timeZone: "Australia/Sydney" },
  { name: "Tromsø", latitude: 69.6492, longitude: 18.9553, timeZone: "Europe/Oslo" },
  { name: "Kathmandu", latitude: 27.7172, longitude: 85.324, timeZone: "Asia/Kathmandu" },
];
const firstPlace = places[0]!;
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.floor(minutes) % 60).padStart(2, "0")}`;
const formatEvent = (date: Date, timeZone: string) => new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);

function App() {
  const [scene, setScene] = useState<(typeof scenes)[number]>(scenes[0]);
  const [place, setPlace] = useState(firstPlace);
  const [instant, setInstant] = useState(() => new Date());
  const [follow, setFollow] = useState(true);
  const [overcast, setOvercast] = useState(false);
  const [paused, setPaused] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [custom, setCustom] = useState(false);
  const [facing, setFacing] = useState(135);
  const [error, setError] = useState("");
  const clock = localClock(instant, place.timeZone);
  const sun = solarPosition(instant, place.latitude, place.longitude);
  const events = useMemo(() => solarDay(clock.date, place.timeZone, place.latitude, place.longitude), [clock.date, place]);
  const phase = sun.elevation >= 0 ? "Daylight" : sun.elevation >= -6 ? "Civil twilight" : sun.elevation >= -12 ? "Nautical twilight" : sun.elevation >= -18 ? "Astronomical twilight" : "Night";

  useEffect(() => {
    if (!follow) return;
    setInstant(new Date());
    const timer = setInterval(() => setInstant(new Date()), 15000);
    return () => clearInterval(timer);
  }, [follow]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setImmersive(false); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  function changeTime(date: string, minutes: number) {
    setFollow(false);
    try {
      setInstant(zonedDateTime(date, minutes, place.timeZone));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This local time is not available. Choose another time.");
    }
  }
  function changePlace(next: typeof firstPlace) {
    try {
      const nextInstant = follow ? new Date() : zonedDateTime(clock.date, clock.minutes, next.timeZone);
      setPlace(next); setInstant(nextInstant); setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Choose a valid location and time.");
    }
  }
  function submitPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const latitude = Number(form.get("latitude")), longitude = Number(form.get("longitude"));
    const timeZone = String(form.get("timeZone")).trim();
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError("Latitude must be −90 to 90, and longitude −180 to 180."); return;
    }
    try { new Intl.DateTimeFormat("en", { timeZone }).format(); }
    catch { setError("Enter an IANA timezone, such as Asia/Hong_Kong."); return; }
    changePlace({ name: "Custom location", latitude, longitude, timeZone });
  }

  return <main className={`app ${immersive ? "immersive" : ""}`} data-phase={phase}>
    <SilhouetteShader scene={scene.id} instant={instant} latitude={place.latitude} longitude={place.longitude} facing={facing} overcast={overcast} paused={paused} />
    <header className="masthead">
      <div><h1>Silhouette<span className="wordmark-dot">.</span></h1><p>Shader studies in light</p></div>
      <button className="view-button" onClick={() => setImmersive(!immersive)} aria-pressed={immersive}>{immersive ? "Show controls" : "Just the light"}</button>
    </header>
    {!immersive && <>
      <aside className="studio" aria-label="Light studio">
        <div className="scene-heading"><h2>{scene.name}</h2><span>{String(scenes.indexOf(scene) + 1).padStart(2, "0")} / 12</span></div>
        <p className="scene-description">{scene.description}</p>
        <div className="scene-list" role="group" aria-label="Light studies">
          {scenes.map(item => <button key={item.id} onClick={() => setScene(item)} aria-pressed={scene.id === item.id} data-scene={item.id}>{item.name}</button>)}
        </div>
        <div className="switches">
          <label><span>Follow the sun</span><input type="checkbox" role="switch" checked={follow} onChange={event => { setFollow(event.target.checked); setError(""); }} /></label>
          <label><span>Overcast</span><input type="checkbox" role="switch" checked={overcast} onChange={event => setOvercast(event.target.checked)} /></label>
          <label><span>Still air</span><input type="checkbox" role="switch" checked={paused} onChange={event => setPaused(event.target.checked)} /></label>
        </div>
        <div className="place-row"><label htmlFor="place">Place</label><select id="place" value={custom ? "custom" : place.name} onChange={event => {
          if (event.target.value === "custom") { setCustom(true); return; }
          const next = places.find(item => item.name === event.target.value);
          if (next) { setCustom(false); changePlace(next); }
        }}>{places.map(item => <option key={item.name}>{item.name}</option>)}<option value="custom">Custom location</option></select></div>
        {custom && <form className="custom-place" onSubmit={submitPlace}>
          <div><label>Latitude<input name="latitude" type="number" min="-90" max="90" step="any" required defaultValue={place.latitude} /></label><label>Longitude<input name="longitude" type="number" min="-180" max="180" step="any" required defaultValue={place.longitude} /></label></div>
          <label>Timezone<input name="timeZone" required defaultValue={place.timeZone} spellCheck={false} /></label>
          <button type="submit">Apply location</button>
        </form>}
        <div className="date-row"><label htmlFor="date">Date</label><input id="date" type="date" min="1900-01-01" max="2100-12-31" value={clock.date} onChange={event => { if (event.target.value) changeTime(event.target.value, clock.minutes); }} /></div>
        <details><summary>Sun & window</summary>
          <div className="solar-details">
            <dl><div><dt>Elevation</dt><dd data-solar="elevation">{sun.elevation.toFixed(1)}°</dd></div><div><dt>Azimuth</dt><dd data-solar="azimuth">{sun.azimuth.toFixed(1)}°</dd></div></dl>
            <label htmlFor="facing">Window faces <output>{facing}°</output></label><input id="facing" type="range" min="0" max="359" step="1" value={facing} onChange={event => setFacing(Number(event.target.value))} />
            <p>Bearings run clockwise from north. Direct light falls away when the sun is behind the window.</p>
            <p>{place.latitude.toFixed(4)}°, {place.longitude.toFixed(4)}°<br />{place.timeZone}</p>
          </div>
        </details>
        {error && <p role="alert" className="form-error">{error}</p>}
      </aside>
      <footer className="time-panel">
        <div className="time-heading"><div><span className="phase">{phase}</span><p>{follow ? "The sun, now" : "A moment of your choosing"}</p></div><label className="clock"><span className="sr-only">Local time</span><input aria-label="Local time" type="time" value={hhmm(clock.minutes)} onChange={event => {
          const [hours, minutes] = event.target.value.split(":").map(Number);
          if (Number.isFinite(hours) && Number.isFinite(minutes)) changeTime(clock.date, hours! * 60 + minutes!);
        }} /></label></div>
        <input className="time-slider" aria-label="Time of day" type="range" min="0" max="1439" step="1" value={clock.minutes} onChange={event => changeTime(clock.date, Number(event.target.value))} />
        <div className="time-scale"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
        <div className="day-events">
          {events.kind === "normal" ? <><span>Sunrise {formatEvent(events.sunrise, place.timeZone)}</span><span>Sunset {formatEvent(events.sunset, place.timeZone)}</span></> : events.kind === "transition" ? <>
            {events.sunrises.map(date => <span key={`rise-${date.toISOString()}`}>Sunrise {formatEvent(date, place.timeZone)}</span>)}
            {events.sunsets.map(date => <span key={`set-${date.toISOString()}`}>Sunset {formatEvent(date, place.timeZone)}</span>)}
            {!events.sunrises.length && <span>No sunrise on this date</span>}
            {!events.sunsets.length && <span>No sunset on this date</span>}
          </> : <span>{events.kind === "polar-day" ? "Midnight sun · no sunset on this date" : "Polar night · no sunrise on this date"}</span>}
          <span className="timezone">{place.timeZone.replaceAll("_", " ")}</span>
        </div>
      </footer>
      <div className="material-note">{scene.material}<span>Rendered with Moonshine</span></div>
    </>}
  </main>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
