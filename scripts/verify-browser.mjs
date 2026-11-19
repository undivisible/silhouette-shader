import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

// Uses the installed Chromium driver, not a mock DOM. Start the app first.
const output = resolve(process.env.EVIDENCE_DIR ?? ".amp/in/orb-backup/browser-check");
mkdirSync(output, { recursive: true });
const prefix = ["--namespace", `studio-${process.pid}`, "--session", "matrix", "--args", "--enable-webgl,--enable-unsafe-swiftshader,--use-angle=swiftshader", "--json"];
function browser(...args) {
  const result = JSON.parse(execFileSync("agent-browser", [...prefix, ...args], { encoding: "utf8", timeout: 60000 }));
  if (!result.success) throw new Error(JSON.stringify(result.error));
  return result.data;
}
function evaluate(code) { return browser("eval", code).result; }
function input(selector, value) {
  evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', {bubbles:true})); e.dispatchEvent(new Event('change', {bubbles:true})); })()`);
}
function settle() { evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))"); }
function capture(name, full = false) { settle(); browser("screenshot", ...(full ? ["--full"] : []), `${output}/${name}.png`); }
function text(selector) { return evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`); }
function pixels(name, format) {
  return execFileSync("magick", [`${output}/${name}.png`, "-crop", "1600x1100+50+220", "+repage", "-format", format, "info:"], { encoding: "utf8" }).trim();
}

const report = { scenes: [], controls: [], rendering: {}, widths: [] };
function framingChecks() {
  browser('wait', 'canvas[data-ready=true]');
  browser('find', 'label', 'Still air', 'check');
  input('.clock', '12:00');
  const frames = [];
  for (const width of [1000, 390]) {
    browser('set', 'viewport', String(width), '740', process.env.STUDIO_DPR ?? '2');
    evaluate('scrollTo(0,0); document.querySelector(".studio").scrollTop=0');
    const layout = evaluate(`(() => {
      const rect = s => document.querySelector(s).getBoundingClientRect();
      const canvas = rect('.light-canvas'), studio = rect('.studio');
      return { width:innerWidth, nonOverlapping:canvas.right <= studio.left || canvas.bottom <= studio.top,
        stillAirClearance: Math.min(innerHeight, studio.bottom) - rect('.switches label:last-child').bottom };
    })()`);
    assert.ok(layout.nonOverlapping && layout.stillAirClearance >= 16, JSON.stringify(layout));
    browser('screenshot', `${output}/framing-${width}.png`);
    browser('select','#place','custom');
    browser('click','summary');
    const targets = evaluate(`Array.from(document.querySelectorAll('button,input,select,summary,a[href]'), e => {
      e.focus(); e.scrollIntoView({block:'center'});
      const r=e.getBoundingClientRect(), hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return { name:e.getAttribute('aria-label') || e.labels?.[0]?.textContent || e.textContent.trim(),
        reachable:document.activeElement===e && e.contains(hit) && r.top>=0 && r.bottom<=innerHeight };
    })`);
    assert.deepEqual(targets.filter(t=>!t.reachable), []);
    browser('scrollintoview','#facing');
    browser('screenshot', `${output}/settings-${width}.png`);
    frames.push({...layout,targets});
    browser('click','summary');
    browser('select','#place','Hong Kong');
  }
  writeFileSync(`${output}/framing.json`,JSON.stringify(frames,null,2));
}
function studioChecks() {
  browser('wait','canvas[data-ready=true]');
  browser('find','label','Still air','check');
  for (const width of [1000, 390]) {
    browser('set', 'viewport', String(width), '740', process.env.STUDIO_DPR ?? '2');
    input('#date', '2024-12-21');
    input('.clock', '12:00');
    browser('click', '[data-scene=slats]');
    evaluate('scrollTo(0,0); document.querySelector(".studio").scrollTop=0');
    assert.equal(evaluate('document.querySelectorAll("[data-scene]").length'), 16);
    assert.ok(evaluate('document.documentElement.scrollWidth <= innerWidth'));
    browser('screenshot', ...(width === 390 ? ['--full'] : []), `${output}/studio-${width}.png`);
    browser('scrollintoview', '.credit a');
    assert.equal(evaluate('document.querySelector(".credit a").href'), 'https://sunstill.app/');
    assert.match(text('.credit'), /web shader inspired by the visual effects of Sunstill.*desktop app.*Buy the original.*Not affiliated with Sunstill/);
    assert.ok(evaluate('document.querySelector(".credit a").getBoundingClientRect().bottom <= innerHeight'));
    browser('select', '#place', 'Kyoto');
    if (width === 390) browser('record','start',`${output}/mobile-study.mp4`,'--fps','5','--cursor');
    browser('click', '[data-scene=opal]');
    assert.equal(text('h2'), 'Opal');
    input('.clock', '23:59');
    browser('click', '.play');
    browser('wait', '--fn', `document.querySelector('#date').value === '2024-12-22'`);
    assert.match(text('.time-heading p'), /Study time/);
    browser('click', '.play');
    assert.equal(text('.time-heading p'), 'Selected local time');
    if (width === 390) browser('record','stop');
    browser('find','label','Follow the sun','check');
    assert.equal(text('.time-heading p'), 'Live local time');
    browser('select', '#place', 'Hong Kong');
    report.widths.push(width);
  }
  browser('click', '.play');
  browser('set','media','light','reduced-motion');
  browser('wait','--fn','document.querySelector(".play").disabled');
  assert.equal(evaluate('document.querySelector(".play").getAttribute("aria-pressed")'), 'false');
  assert.ok(evaluate('document.querySelectorAll(".switches input")[2].checked'));
  report.controls = ['scene selection', 'place', 'manual time', 'midnight advances date', 'study pause', 'resume live time', 'credit text and destination', 'reduced motion stops playback'];
  writeFileSync(`${output}/studio-results.json`, JSON.stringify(report, null, 2));
}
try {
  browser('open','about:blank');
  browser('set','viewport','390','740','2');
  browser("open", process.env.PREVIEW_URL ?? "http://localhost:30574");
  if (process.argv.includes('--framing')) {
    framingChecks();
    console.log('PASS: framing and control reachability');
  } else if (process.argv.includes('--studio')) {
    studioChecks();
    console.log('PASS: desktop and mobile studio checks');
  } else {
  browser("set", "viewport", "1280", "800", "2");
  browser("wait", "canvas[data-ready=true]");
  assert.equal(evaluate("document.querySelectorAll('[data-scene]').length"), 16);
  capture("default");
  browser("click", "summary");
  input("#date", "2024-12-21");
  input("input[type=time]", "12:00");
  assert.equal(evaluate("document.querySelector('input[role=switch]').checked"), false);
  assert.equal(evaluate("document.querySelector('main').dataset.phase"), "Daylight");
  assert.ok(Math.abs(parseFloat(text('[data-solar=elevation]')) - 43.9444) < .1);
  assert.ok(Math.abs(parseFloat(text('[data-solar=azimuth]')) - 173.1609) < .1);
  browser("click", "summary");
  browser("find", "label", "Still air", "check");
  input("input[type=time]", "12:00");
  const ids = evaluate("[...document.querySelectorAll('[data-scene]')].map(e=>e.dataset.scene)");
  const signatures = new Set();
  for (const id of ids) {
    browser("click", `[data-scene=${id}]`);
    assert.equal(evaluate("document.querySelector('[data-scene][aria-pressed=true]').dataset.scene"), id);
    assert.equal(evaluate("document.querySelector('canvas').getAttribute('aria-label')"), `${text('h2')} light study`);
    capture(id);
    const signature = pixels(id, "%#");
    signatures.add(signature);
    report.scenes.push({ id, signature });
  }
  assert.equal(signatures.size, 16, "Every scene must render different pixels");
  browser("click", "[data-scene=bough]");
  capture("noon");
  const noon = Number(pixels("noon", "%[fx:mean]"));
  browser("find", "label", "Overcast", "check");
  capture("overcast");
  const overcast = Number(pixels("overcast", "%[fx:mean]"));
  assert.ok(overcast < noon, "Overcast must attenuate direct light");
  browser("find", "label", "Overcast", "click");
  input("input[type=time]", "00:00");
  assert.equal(evaluate("document.querySelector('main').dataset.phase"), "Night");
  capture("night");
  const night = Number(pixels("night", "%[fx:mean]"));
  assert.ok(night < noon * .3, "Night must remove sunlight, not wrap a daily animation");
  input("input[type=time]", "18:00");
  assert.match(text(".phase"), /twilight/);
  capture("twilight");
  browser("select", "#place", "New York");
  input("#date", "2024-03-10");
  input("input[type=time]", "12:00");
  assert.match(text(".day-events"), /Sunrise 07:14/);
  input("input[type=time]", "02:30");
  assert.match(text("[role=alert]"), /does not exist/);
  capture("dst-gap");
  input("input[type=time]", "12:00");
  browser("select", "#place", "Tromsø");
  input("#date", "2024-06-21");
  assert.match(text(".day-events"), /Midnight sun/);
  capture("polar-day");
  input("#date", "2024-12-21");
  assert.match(text(".day-events"), /Polar night/);
  capture("polar-night");
  input("#date", "2024-05-16");
  assert.match(text(".day-events"), /Sunrise/);
  assert.match(text(".day-events"), /No sunset on this date/);
  capture("polar-transition");
  browser("select", "#place", "Kathmandu");
  input("#date", "2024-06-21");
  input("input[type=time]", "06:15");
  browser("click", "summary");
  assert.ok(Math.abs(parseFloat(text('[data-solar=elevation]')) - 12.6233) < .1);
  browser("click", "summary");
  browser("select", "#place", "custom");
  browser("fill", "input[name=timeZone]", "Not/A_Timezone");
  browser("click", "button[type=submit]");
  assert.match(text("[role=alert]"), /IANA timezone/);
  browser("fill", "input[name=latitude]", "-33.8688");
  browser("fill", "input[name=longitude]", "151.2093");
  browser("fill", "input[name=timeZone]", "Australia/Sydney");
  browser("click", "button[type=submit]");
  assert.match(text(".timezone"), /Australia\/Sydney/);
  browser("select", "#place", "Hong Kong");
  input("#date", "2024-12-21");
  input("input[type=time]", "12:00");
  browser("click", ".view-button");
  assert.ok(evaluate("document.querySelector('.studio').inert"));
  browser("press", "Escape");
  assert.equal(evaluate("document.querySelector('.studio').inert"), false);
  report.controls = ["scene selection", "time scrubbing", "follow disengages", "overcast", "still air", "date", "timezone", "DST rejection", "polar dates", "custom coordinates", "invalid timezone", "immersive + Escape"];
  report.rendering = { noonMean: noon, overcastMean: overcast, nightMean: night, distinctScenes: signatures.size, solarFixtures: "Hong Kong winter noon and Kathmandu morning" };
  for (const width of [1280, 768, 390]) {
    browser("set", "viewport", String(width), "800", "2"); settle();
    assert.ok(evaluate("document.documentElement.scrollWidth <= innerWidth"), `Horizontal overflow at ${width}`);
    capture(`width-${width}`, width === 390);
    report.widths.push(width);
  }
  assert.deepEqual(browser("errors").errors ?? [], []);
  writeFileSync(`${output}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log("PASS: 16 distinct rendered scenes, solar fixtures, controls, day/night, and 3 viewport widths");
  }
} finally {
  browser("close");
}
