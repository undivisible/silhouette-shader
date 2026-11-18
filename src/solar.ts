const RAD = Math.PI / 180;
const MINUTE = 60_000;
const DAY = 86_400_000;
const sin = (degrees: number) => Math.sin(degrees * RAD);
const cos = (degrees: number) => Math.cos(degrees * RAD);
const wrap = (degrees: number) => ((degrees % 360) + 360) % 360;

function coordinates(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new RangeError('Latitude must be within ±90°, longitude within ±180°.');
  }
}

function instant(date: Date) {
  const value = date.getTime();
  if (!Number.isFinite(value)) throw new RangeError('Invalid date.');
  return value;
}

/**
 * Solar center, without atmospheric refraction or terrain/horizon corrections.
 * Latitude is north-positive, longitude east-positive; azimuth is north-clockwise
 * in [0, 360). Uses a low-order apparent solar ephemeris, intended for modern
 * dates (roughly 1900–2100), not precision surveying. Azimuth at the zenith or
 * nadir is inherently undefined; the returned bearing there is arbitrary.
 */
export function solarPosition(date: Date, latitude: number, longitude: number) {
  coordinates(latitude, longitude);
  const jd = instant(date) / DAY + 2440587.5;
  const t = (jd - 2451545) / 36525;
  const meanLongitude = wrap(280.46646 + t * (36000.76983 + t * 0.0003032));
  const anomaly = wrap(357.52911 + t * (35999.05029 - 0.0001537 * t));
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const center = sin(anomaly) * (1.914602 - t * (0.004817 + 0.000014 * t))
    + sin(2 * anomaly) * (0.019993 - 0.000101 * t) + 0.000289 * sin(3 * anomaly);
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude = meanLongitude + center - 0.00569 - 0.00478 * sin(omega);
  const obliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    + 0.00256 * cos(omega);
  const declination = Math.asin(sin(obliquity) * sin(apparentLongitude));
  const rightAscension = Math.atan2(cos(obliquity) * sin(apparentLongitude), cos(apparentLongitude)) / RAD;
  const sidereal = 280.46061837 + 360.98564736629 * (jd - 2451545)
    + 0.000387933 * t * t - t * t * t / 38710000;
  const apparentSidereal = sidereal - 0.00478 * sin(omega) * cos(obliquity);
  const hourAngle = wrap(apparentSidereal + longitude - rightAscension) * RAD;
  const phi = latitude * RAD;
  const geocentricElevation = Math.asin(Math.max(-1, Math.min(1,
    Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle))));
  // Solar parallax shifts the geometric center down by at most 9 arcseconds.
  const distance = 1.000001018 * (1 - eccentricity ** 2) / (1 + eccentricity * cos(anomaly + center));
  const elevation = geocentricElevation / RAD - 8.794 / 3600 / distance * Math.cos(geocentricElevation);
  const azimuth = wrap(Math.atan2(Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi)) / RAD + 180);
  return { elevation, azimuth };
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let result = formatters.get(timeZone);
  if (!result) {
    result = new Intl.DateTimeFormat('en-CA-u-ca-iso8601-nu-latn', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    formatters.set(timeZone, result);
  }
  return result;
}

/** Local ISO civil date and fractional minutes since midnight (seconds preserved). */
export function localClock(date: Date, timeZone: string): { date: string; minutes: number } {
  const ms = instant(date);
  const fields = formatter(timeZone).formatToParts(date);
  const field = (type: string) => {
    const part = fields.find((entry) => entry.type === type);
    if (!part) throw new RangeError(`Missing calendar field: ${type}`);
    return part.value;
  };
  return {
    date: `${field('year').padStart(4, '0')}-${field('month')}-${field('day')}`,
    minutes: Number(field('hour')) * 60 + Number(field('minute')) + Number(field('second')) / 60
      + (((ms % 1000) + 1000) % 1000) / MINUTE,
  };
}

function civilDate(dateString: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || dateString.startsWith('0000')) {
    throw new RangeError('Expected a civil date in YYYY-MM-DD format (years 0001–9999).');
  }
  const ms = Date.parse(`${dateString}T00:00:00.000Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== dateString) {
    throw new RangeError('Invalid civil date.');
  }
  return ms;
}

/**
 * Resolve local civil time in an IANA zone. Gaps (including skipped dates) throw
 * RangeError; a fold deliberately chooses the earlier of its possible instants.
 * Minutes must be in [0, 1440); fractional minutes are rounded to milliseconds.
 */
export function zonedDateTime(dateString: string, minutes: number, timeZone: string): Date {
  const midnight = civilDate(dateString);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes >= 1440) {
    throw new RangeError('Minutes must be within [0, 1440).');
  }
  formatter(timeZone);
  const wall = midnight + Math.round(minutes * MINUTE);
  if (wall >= midnight + DAY) throw new RangeError('Time rounds beyond the selected date.');
  const offsets = new Set<number>();
  // Sample both sides of nearby offset changes, including non-hour transitions.
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = wall + hours * 60 * MINUTE;
    const local = localClock(new Date(sample), timeZone);
    offsets.add(civilDate(local.date) + Math.round(local.minutes * MINUTE) - sample);
  }
  const matches: number[] = [];
  for (const offset of offsets) {
    const candidate = wall - offset;
    const local = localClock(new Date(candidate), timeZone);
    if (local.date === dateString && Math.round(local.minutes * MINUTE) === wall - midnight) {
      matches.push(candidate);
    }
  }
  if (matches.length === 0) throw new RangeError('This local time does not exist in the selected timezone.');
  return new Date(Math.min(...matches));
}

export type SolarDay =
  | { kind: 'normal'; sunrise: Date; sunset: Date }
  | { kind: 'polar-day' }
  | { kind: 'polar-night' }
  | { kind: 'transition'; sunrises: Date[]; sunsets: Date[] };

function dayBoundary(dateString: string, timeZone: string) {
  const nominal = civilDate(dateString);
  let low = nominal - 2 * DAY;
  let high = nominal + 2 * DAY;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (localClock(new Date(middle), timeZone).date < dateString) low = middle;
    else high = middle;
  }
  return high;
}

/**
 * Sunrise/set use center elevation −0.833° (standard level-horizon limb and
 * refraction convention), not 0°. Events belong to the chosen local civil date,
 * whose duration may differ from 24h. A transition has only one event or multiple
 * events; no fictitious second event is invented. Skipped civil dates throw.
 */
export function solarDay(dateString: string, timeZone: string, latitude: number, longitude: number): SolarDay {
  coordinates(latitude, longitude);
  const nominal = civilDate(dateString);
  const start = dayBoundary(dateString, timeZone);
  if (localClock(new Date(start), timeZone).date !== dateString) {
    throw new RangeError('This civil date does not exist in the selected timezone.');
  }
  const nextDate = new Date(nominal + DAY).toISOString().slice(0, 10);
  const end = dayBoundary(nextDate, timeZone);
  const altitude = (ms: number) => solarPosition(new Date(ms), latitude, longitude).elevation + 0.833;
  const step = 5 * MINUTE;
  const samples: { time: number; value: number }[] = [];
  for (let time = start - step; time <= end + 2 * step; time += step) {
    samples.push({ time, value: altitude(time) });
  }
  const points = [{ time: start, value: altitude(start) }, { time: end, value: altitude(end) }];
  for (let i = 1; i < samples.length - 1; i++) {
    const previous = samples[i - 1];
    const current = samples[i];
    const next = samples[i + 1];
    if (!previous || !current || !next) continue;
    if (current.time > start && current.time < end) points.push(current);
    const maximum = current.value > previous.value && current.value > next.value;
    const minimum = current.value < previous.value && current.value < next.value;
    if (!maximum && !minimum) continue;
    // Include true extrema so brief near-polar daylight/darkness isn't lost
    // between samples. A tangency without a sign change is not a rise or set.
    let low = previous.time;
    let high = next.time;
    for (let iteration = 0; iteration < 40; iteration++) {
      const a = low + (high - low) / 3;
      const b = high - (high - low) / 3;
      if ((altitude(a) < altitude(b)) === maximum) low = a;
      else high = b;
    }
    const time = (low + high) / 2;
    if (time > start && time < end) points.push({ time, value: altitude(time) });
  }
  points.sort((a, b) => a.time - b.time);
  const sunrises: Date[] = [];
  const sunsets: Date[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b || (a.value >= 0) === (b.value >= 0)) continue;
    let low = a.time;
    let high = b.time;
    for (let iteration = 0; iteration < 24; iteration++) {
      const middle = (low + high) / 2;
      if ((altitude(middle) >= 0) === (a.value >= 0)) low = middle;
      else high = middle;
    }
    const time = Math.round((low + high) / 2);
    if (time >= start && time < end) {
      (a.value < b.value ? sunrises : sunsets).push(new Date(time));
    }
  }
  if (sunrises.length === 1 && sunsets.length === 1 && sunrises[0] && sunsets[0]) {
    return { kind: 'normal', sunrise: sunrises[0], sunset: sunsets[0] };
  }
  if (sunrises.length || sunsets.length) return { kind: 'transition', sunrises, sunsets };
  return { kind: altitude((start + end) / 2) >= 0 ? 'polar-day' : 'polar-night' };
}
