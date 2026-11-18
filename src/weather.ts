/* ISC License. Copyright (c) 2026 undivisible
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE. */
export type WeatherCondition = 'clear' | 'cloud' | 'fog' | 'rain' | 'storm' | 'snow';

/** Mount on a transparent, CSS-sized canvas. Dispose before reusing the element. */
export function mountWeather(canvas: HTMLCanvasElement, condition: WeatherCondition, { animated = true } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  let frame = 0, disposed = false;
  const start = performance.now();
  const random = (n: number) => { const k = Math.sin(n * 127.1 + 7) * 43758.5453; return k - Math.floor(k); };
  function paint(now: number) {
    if (disposed || !ctx) return;
    const t = animated ? (now - start) / 1000 : 0;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const ratio = Math.min(devicePixelRatio, 2);
    if (canvas.width !== Math.round(w * ratio)) canvas.width = Math.round(w * ratio);
    if (canvas.height !== Math.round(h * ratio)) canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!w || !h) return;
    const mist = condition === 'fog', storm = condition === 'storm';
    if (condition === 'cloud' || mist || storm || condition === 'clear') {
      const count = condition === 'clear' ? 1 : 16;
      for (let i = 0; i < count; i++) {
        const x = count === 1 ? w * .77 : (random(i) + .05 * Math.sin(t * .11 + i)) * w;
        const y = count === 1 ? h * .22 : (random(i + 34) * (mist ? .75 : .45) + (mist ? .2 : 0)) * h;
        ctx.save(); ctx.translate(x,y); ctx.scale(w, h * (mist ? .35 : .8));
        const g = ctx.createRadialGradient(0,0,0,0,0,count === 1 ? .42 : .28);
        const rgb = count === 1 ? '255,213,135' : storm ? '107,124,155' : '207,219,227';
        g.addColorStop(0, `rgba(${rgb},${count === 1 ? .36 : .22})`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.fillRect(-1,-1,2,2); ctx.restore();
      }
    }
    if (condition === 'rain' || storm || condition === 'snow') {
      const snow = condition === 'snow';
      for (let i=0; i<(storm ? 150 : 90); i++) {
        const z = random(i+18), y = ((random(i+33) + t * (snow ? .09 : .9) * (.35+z)) % 1) * (h+26)-13;
        const x = ((random(i) + (snow ? .02*Math.sin(t+i) : -y/w*(storm ? .38 : .10)) + 1) % 1)*w;
        ctx.beginPath();
        if (snow) { ctx.fillStyle = `rgba(246,250,255,${.34+z*.6})`; ctx.arc(x,y,.6+z*1.9,0,Math.PI*2); ctx.fill(); }
        else { const length = (storm ? 18 : 10)*(.45+z); ctx.strokeStyle=`rgba(181,210,231,${.21+.48*z})`; ctx.lineWidth=.55+z*.8; ctx.moveTo(x,y); ctx.lineTo(x-length*(storm ? .38 : .1),y+length); ctx.stroke(); }
      }
    }
  }
  const loop = (now: number) => { paint(now); if (!disposed) frame = requestAnimationFrame(loop); };
  const observer = new ResizeObserver(() => paint(performance.now()));
  observer.observe(canvas); paint(start);
  if (animated && condition !== 'clear') frame = requestAnimationFrame(loop);
  return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); };
}
