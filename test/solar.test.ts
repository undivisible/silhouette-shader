import { describe, expect, test } from 'bun:test';
import { localClock, solarDay, solarPosition, zonedDateTime } from '../src/solar';

const circularDifference = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

// Published NREL SPA worked example: https://docs.nlr.gov/docs/fy08osti/34302.pdf
// Other fixed position/event fixtures use pyswisseph 2.10.3.2's independent
// Moshier ephemeris, sea-level topocentric coordinates and unrefracted altitude.
describe('geometric solar position', () => {
  test('published Colorado worked example, with no atmospheric refraction', () => {
    const actual = solarPosition(new Date('2003-10-17T19:30:30Z'), 39.742476, -105.1786);
    // Published azimuth and independently evaluated unrefracted center altitude.
    expect(circularDifference(actual.azimuth, 194.340241)).toBeLessThan(0.01);
    expect(Math.abs(actual.elevation - 39.87208131)).toBeLessThan(0.01);
  });

  // Fixed fixtures evaluated with an independent numerical ephemeris, using
  // topocentric coordinates at sea level and the unrefracted center altitude.
  const cases = [
    { name: 'Hong Kong June solstice', utc: '2024-06-20T04:00:00Z', lat: 22.3193, lon: 114.1694, elevation: 84.14452347, azimuth: 77.79775345 },
    { name: 'Hong Kong December solstice', utc: '2024-12-21T04:00:00Z', lat: 22.3193, lon: 114.1694, elevation: 43.94442420, azimuth: 173.16086893 },
    { name: 'Sydney winter, bearing wraps through north', utc: '2024-06-20T02:00:00Z', lat: -33.8688, lon: 151.2093, elevation: 32.68792935, azimuth: 359.12194611 },
    { name: 'Sydney summer', utc: '2024-12-21T02:00:00Z', lat: -33.8688, lon: 151.2093, elevation: 79.46464358, azimuth: 351.49833203 },
    { name: 'London leap date', utc: '2024-02-29T12:00:00Z', lat: 51.5074, lon: -0.1278, elevation: 30.75256112, azimuth: 176.27843356 },
    { name: 'New York below horizon', utc: '2024-03-20T10:00:00Z', lat: 40.7128, lon: -74.006, elevation: -11.86662603, azimuth: 79.42907384 },
    { name: 'equator east longitude', utc: '2024-03-20T06:00:00Z', lat: 0, lon: 90, elevation: 88.15342985, azimuth: 88.51842382 },
    { name: 'equator west longitude', utc: '2024-03-20T06:00:00Z', lat: 0, lon: -90, elevation: -88.15376599, azimuth: 271.48171142 },
    { name: 'Kathmandu morning', utc: '2024-06-21T00:30:00Z', lat: 27.7172, lon: 85.324, elevation: 12.62329117, azimuth: 69.95468511 },
    { name: 'Hong Kong local leap date, previous UTC date', utc: '2024-02-28T23:59:00Z', lat: 22.3193, lon: 114.1694, elevation: 15.86545917, azimuth: 105.68947862 },
  ];
  for (const entry of cases) {
    test(entry.name, () => {
      const actual = solarPosition(new Date(entry.utc), entry.lat, entry.lon);
      expect(Math.abs(actual.elevation - entry.elevation)).toBeLessThan(0.01);
      expect(circularDifference(actual.azimuth, entry.azimuth)).toBeLessThan(0.03);
      expect(actual.azimuth).toBeGreaterThanOrEqual(0);
      expect(actual.azimuth).toBeLessThan(360);
    });
  }

  test('invalid inputs are rejected instead of producing NaNs', () => {
    for (const [lat, lon] of [[91, 0], [-91, 0], [0, 181], [0, -181], [NaN, 0], [0, Infinity]]) {
      expect(() => solarPosition(new Date(), lat ?? NaN, lon ?? NaN)).toThrow(RangeError);
    }
    expect(() => solarPosition(new Date(NaN), 0, 0)).toThrow(RangeError);
  });
});

describe('civil time conversion', () => {
  const cases = [
    { date: '2024-02-29', minutes: 30, zone: 'Asia/Hong_Kong', utc: '2024-02-28T16:30:00.000Z' },
    { date: '2024-12-31', minutes: 23 * 60 + 30, zone: 'America/Los_Angeles', utc: '2025-01-01T07:30:00.000Z' },
    { date: '2024-06-21', minutes: 375, zone: 'Asia/Kathmandu', utc: '2024-06-21T00:30:00.000Z' },
    { date: '2024-06-21', minutes: 360, zone: 'Asia/Kolkata', utc: '2024-06-21T00:30:00.000Z' },
    { date: '2024-06-21', minutes: 0, zone: 'Pacific/Chatham', utc: '2024-06-20T11:15:00.000Z' },
    { date: '2024-01-01', minutes: 0, zone: 'Pacific/Kiritimati', utc: '2023-12-31T10:00:00.000Z' },
    { date: '2024-02-29', minutes: 0, zone: 'UTC', utc: '2024-02-29T00:00:00.000Z' },
    { date: '2024-02-29', minutes: 720.5125, zone: 'UTC', utc: '2024-02-29T12:00:30.750Z' },
  ];
  for (const entry of cases) {
    test(`${entry.zone}: ${entry.date}, ${entry.minutes} minutes`, () => {
      const date = zonedDateTime(entry.date, entry.minutes, entry.zone);
      expect(date.toISOString()).toBe(entry.utc);
      expect(localClock(new Date(entry.utc), entry.zone)).toEqual({ date: entry.date, minutes: entry.minutes });
    });
  }

  test('spring DST gap rejects, times on either side resolve normally', () => {
    expect(() => zonedDateTime('2024-03-10', 150, 'America/New_York')).toThrow(RangeError);
    expect(zonedDateTime('2024-03-10', 119, 'America/New_York').toISOString()).toBe('2024-03-10T06:59:00.000Z');
    expect(zonedDateTime('2024-03-10', 180, 'America/New_York').toISOString()).toBe('2024-03-10T07:00:00.000Z');
  });

  test('autumn DST fold consistently chooses the earlier instant', () => {
    expect(zonedDateTime('2024-11-03', 90, 'America/New_York').toISOString()).toBe('2024-11-03T05:30:00.000Z');
    for (const utc of ['2024-11-03T05:30:00Z', '2024-11-03T06:30:00Z']) {
      expect(localClock(new Date(utc), 'America/New_York')).toEqual({ date: '2024-11-03', minutes: 90 });
    }
  });

  test('half-hour DST transitions', () => {
    expect(() => zonedDateTime('2024-10-06', 135, 'Australia/Lord_Howe')).toThrow(RangeError);
    expect(zonedDateTime('2024-04-07', 105, 'Australia/Lord_Howe').toISOString()).toBe('2024-04-06T14:45:00.000Z');
  });

  test('skipped date and midnight gap', () => {
    expect(() => zonedDateTime('2011-12-30', 720, 'Pacific/Apia')).toThrow(RangeError);
    expect(() => zonedDateTime('2018-11-04', 30, 'America/Sao_Paulo')).toThrow(RangeError);
    expect(zonedDateTime('2018-11-04', 60, 'America/Sao_Paulo').toISOString()).toBe('2018-11-04T03:00:00.000Z');
  });

  test('strict calendar, time, timezone and instant validation', () => {
    for (const date of ['2023-02-29', '2024-02-30', '2024-13-01', '2024-6-1', 'garbage', '0000-01-01']) {
      expect(() => zonedDateTime(date, 0, 'UTC')).toThrow(RangeError);
    }
    for (const minutes of [-1, 1440, NaN, Infinity]) {
      expect(() => zonedDateTime('2024-06-20', minutes, 'UTC')).toThrow(RangeError);
    }
    expect(() => zonedDateTime('2024-06-20', 0, 'Nowhere/Invalid')).toThrow(RangeError);
    expect(() => localClock(new Date(NaN), 'UTC')).toThrow(RangeError);
  });
});

describe('solar events for the actual local date', () => {
  const cases = [
    { date: '2024-06-20', zone: 'Asia/Hong_Kong', lat: 22.3193, lon: 114.1694, rise: '2024-06-19T21:39:54.803Z', set: '2024-06-20T11:10:00.645Z' },
    { date: '2024-12-21', zone: 'Australia/Sydney', lat: -33.8688, lon: 151.2093, rise: '2024-12-20T18:40:51.708Z', set: '2024-12-21T09:05:37.938Z' },
    { date: '2024-03-10', zone: 'America/New_York', lat: 40.7128, lon: -74.006, rise: '2024-03-10T11:14:54.426Z', set: '2024-03-10T22:57:55.625Z' },
    { date: '2024-11-03', zone: 'America/New_York', lat: 40.7128, lon: -74.006, rise: '2024-11-03T11:29:20.993Z', set: '2024-11-03T21:49:18.116Z' },
    { date: '2024-06-21', zone: 'Asia/Kathmandu', lat: 27.7172, lon: 85.324, rise: '2024-06-20T23:23:38.264Z', set: '2024-06-21T13:17:30.454Z' },
    { date: '2024-05-17', zone: 'Europe/Oslo', lat: 69.6492, lon: 18.9553, rise: '2024-05-16T23:08:08.473Z', set: '2024-05-16T22:12:09.148Z' },
  ];
  for (const entry of cases) {
    test(`${entry.zone}, ${entry.date}`, () => {
      const day = solarDay(entry.date, entry.zone, entry.lat, entry.lon);
      expect(day.kind).toBe('normal');
      if (day.kind !== 'normal') throw new Error('Expected two events.');
      expect(Math.abs(day.sunrise.getTime() - Date.parse(entry.rise))).toBeLessThan(15_000);
      expect(Math.abs(day.sunset.getTime() - Date.parse(entry.set))).toBeLessThan(15_000);
      expect(localClock(day.sunrise, entry.zone).date).toBe(entry.date);
      expect(localClock(day.sunset, entry.zone).date).toBe(entry.date);
      expect(solarPosition(day.sunrise, entry.lat, entry.lon).elevation).toBeCloseTo(-0.833, 4);
      expect(solarPosition(new Date(day.sunrise.getTime() + 60_000), entry.lat, entry.lon).elevation).toBeGreaterThan(-0.833);
      expect(solarPosition(new Date(day.sunset.getTime() + 60_000), entry.lat, entry.lon).elevation).toBeLessThan(-0.833);
    });
  }

  test('published Colorado sunrise and independent sunset on the chosen civil date', () => {
    const day = solarDay('2003-10-17', 'America/Denver', 39.742476, -105.1786);
    expect(day.kind).toBe('normal');
    if (day.kind !== 'normal') throw new Error('Expected two events.');
    expect(Math.abs(day.sunrise.getTime() - Date.parse('2003-10-17T13:12:43.460Z'))).toBeLessThan(30_000);
    expect(Math.abs(day.sunset.getTime() - Date.parse('2003-10-18T00:18:50.847Z'))).toBeLessThan(15_000);
  });

  test('polar summer and winter in both hemispheres, including poles', () => {
    expect(solarDay('2024-06-21', 'Europe/Oslo', 69.6492, 18.9553)).toEqual({ kind: 'polar-day' });
    expect(solarDay('2024-12-21', 'Europe/Oslo', 69.6492, 18.9553)).toEqual({ kind: 'polar-night' });
    expect(solarDay('2024-06-21', 'Antarctica/McMurdo', -77.8419, 166.6863)).toEqual({ kind: 'polar-night' });
    expect(solarDay('2024-12-21', 'Antarctica/McMurdo', -77.8419, 166.6863)).toEqual({ kind: 'polar-day' });
    expect(solarDay('2024-06-21', 'UTC', 90, 0)).toEqual({ kind: 'polar-day' });
    expect(solarDay('2024-06-21', 'UTC', -90, 0)).toEqual({ kind: 'polar-night' });
  });

  test('a near-polar transition date does not invent a sunset', () => {
    const day = solarDay('2024-05-16', 'Europe/Oslo', 69.6492, 18.9553);
    expect(day.kind).toBe('transition');
    if (day.kind !== 'transition') throw new Error('Expected a single event.');
    expect(day.sunrises).toHaveLength(1);
    expect(day.sunsets).toHaveLength(0);
    expect(day.sunrises.map((date) => localClock(date, 'Europe/Oslo').date)).toEqual(['2024-05-16']);
    const sunrise = day.sunrises[0];
    if (!sunrise) throw new Error('Expected a sunrise.');
    expect(Math.abs(sunrise.getTime() - Date.parse('2024-05-15T23:25:25.558Z'))).toBeLessThan(15_000);
  });

  test('midnight DST gap does not make the whole date nonexistent', () => {
    expect(solarDay('2018-11-04', 'America/Sao_Paulo', -23.5505, -46.6333).kind).toBe('normal');
    expect(() => solarDay('2011-12-30', 'Pacific/Apia', -13.8333, -171.75)).toThrow(RangeError);
    expect(() => solarDay('2024-02-30', 'UTC', 0, 0)).toThrow(RangeError);
    expect(() => solarDay('2024-06-20', 'UTC', 91, 0)).toThrow(RangeError);
  });
});
