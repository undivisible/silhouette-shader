import { createFullscreenFragment } from '@tschk/moonshine-next/shaders';
import { silhouetteFragment } from './shader';
import { scenes, type SceneId } from './scenes';
import { solarPosition } from './solar';
import { materialMask } from './materialMasks';
import { leafProjection } from './leafProjection';
import { PaneFlow, paneWidth, paneHeight } from './paneFlow';

const rainGlass = new Set<SceneId>(['bough','slats','spectrum','pendant','opal','oculus']);

export const conditions = ['clear','cloud','fog','rain','storm','snow'] as const;
export type WeatherCondition = typeof conditions[number];
export type RoomOptions = { scene?: SceneId; instant?: Date; latitude?: number; longitude?: number; facing?: number; animated?: boolean; overcast?: boolean; preview?: HTMLCanvasElement | null; onError?: (message: string) => void };

export function mountRoom(canvas: HTMLCanvasElement, condition: WeatherCondition, options: RoomOptions = {}) {
  const gl = canvas.getContext('webgl2', { alpha:false, antialias:false, depth:false });
  if (!gl) throw new Error('This light study needs WebGL 2. Try a browser with hardware acceleration enabled.');
  const program = gl.createProgram();
  if (!program) throw new Error('Could not allocate graphics program');
  const sources = createFullscreenFragment(silhouetteFragment);
  try {
    for (const [kind, source] of [[gl.VERTEX_SHADER,sources.vertex],[gl.FRAGMENT_SHADER,sources.fragment]] as const) {
      const shader = gl.createShader(kind); if (!shader) throw new Error('Could not allocate shader');
      gl.attachShader(program,shader); gl.deleteShader(shader); gl.shaderSource(shader,source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compilation failed');
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Program link failed');
  } catch (e) { gl.deleteProgram(program); throw e; }
  const u = Object.fromEntries(['time','resolution','weather','scene','azimuth','projection','elevation','facing','overcast','authored','mask','film','previous','previousOpacity'].map(k=>[k,gl.getUniformLocation(program,'u_'+k)]));
  const texture=gl.createTexture();let material:SceneId|undefined;
  let leaves:ReturnType<typeof leafProjection>|undefined;
  let rain: { flow:PaneFlow; texture:WebGLTexture } | undefined;
  let frame=0, elapsed=0, last=performance.now(), cloud=Number(!!options.overcast), disposed=false;
  let previous:WebGLTexture|null=null, fadeStart=-Infinity;
  let altitude:number|undefined, bearing:number|undefined;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  function paint(now: number) {
    if (!gl || disposed || gl.isContextLost()) return;
    cancelAnimationFrame(frame);
    const moving=options.animated!==false && !reduce.matches;
    now=Math.max(now,last);
    const dt=(now-last)/1000; last=now;
    if(moving) elapsed+=dt;
    const w=Math.max(1,Math.round(canvas.clientWidth*Math.min(devicePixelRatio,1.5))),h=Math.max(1,Math.round(canvas.clientHeight*Math.min(devicePixelRatio,1.5)));
    if(canvas.width!==w) canvas.width=w; if(canvas.height!==h) canvas.height=h;
    gl.useProgram(program); gl.viewport(0,0,w,h);
    const selected=options.scene??'slats';
    if(material!==selected){
      const mask=selected==='slats'?null:materialMask(selected);gl.bindTexture(gl.TEXTURE_2D,texture);
      if(selected==='slats')gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,882,495,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      else if(mask)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mask);
      else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      const wrap=selected==='canopy'?gl.MIRRORED_REPEAT:gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);
      gl.uniform1i(u.mask,0);gl.uniform1f(u.authored,Number(!!mask||selected==='slats'));material=selected;
    }
    if(selected==='rain'||((condition==='rain'||condition==='storm')&&rainGlass.has(selected))){
      if(!rain){
        const film=gl.createTexture();if(!film)throw new Error('Could not allocate glass surface');
        const flow=new PaneFlow();rain={texture:film,flow};
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,film);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,paneWidth,paneHeight,0,gl.RED,gl.UNSIGNED_BYTE,flow.height);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.uniform1i(u.film,1);gl.activeTexture(gl.TEXTURE0);
      }else if(moving&&!document.hidden&&rain.flow.advance(dt,condition==='storm')){
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,rain.texture);
        gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,paneWidth,paneHeight,gl.RED,gl.UNSIGNED_BYTE,rain.flow.height);
        gl.activeTexture(gl.TEXTURE0);
      }
    }
    const sun=solarPosition(options.instant ?? new Date(), options.latitude ?? 3.139,options.longitude ?? 101.687);
    const rad=Math.PI/180, target=Number(!!options.overcast);
    const targetBearing=(sun.azimuth-(options.facing??135))*rad, targetAltitude=sun.elevation*rad;
    const residual=moving?Math.exp(-dt*7):0;
    const angleDelta=(bearing??targetBearing)-targetBearing;
    bearing=targetBearing+Math.atan2(Math.sin(angleDelta),Math.cos(angleDelta))*residual;
    altitude=targetAltitude+((altitude??targetAltitude)-targetAltitude)*residual;
    // A rear-facing sun cannot project a beam through the window. Ease its
    // signed displacement to zero before the +/-pi bearing cut, and settle
    // the diffuse night footprint as the solar disc goes below the horizon.
    const ease=(x:number)=>{const v=Math.min(1,Math.max(0,x));return v*v*(3-2*v);};
    const angle=Math.atan2(Math.sin(bearing),Math.cos(bearing));
    const projection=angle*ease((Math.PI-Math.abs(angle))/(Math.PI/2))*ease((altitude+.19)/.32);
    if(selected==='slats'&&texture){
      leaves??=leafProjection(gl);
      gl.activeTexture(gl.TEXTURE0);leaves.draw(texture,elapsed,projection,altitude);
      gl.useProgram(program);gl.viewport(0,0,w,h);
    }
    cloud=target+(cloud-target)*residual;
    const progress=moving?Math.min(1,(now-fadeStart)/550):1;
    gl.uniform1i(u.previous,2);gl.uniform1f(u.previousOpacity,1-progress*progress*(3-2*progress));
    if(progress===1 && previous){gl.deleteTexture(previous);previous=null;fadeStart=-Infinity;}
    gl.uniform1f(u.projection,projection);
    gl.uniform2f(u.resolution,w,h); gl.uniform1f(u.time,elapsed); gl.uniform1f(u.weather,conditions.indexOf(condition));
    gl.uniform1f(u.scene,scenes.findIndex(s=>s.id===selected)); gl.uniform1f(u.azimuth,bearing+(options.facing??135)*rad); gl.uniform1f(u.elevation,altitude); gl.uniform1f(u.facing,(options.facing??135)*rad); gl.uniform1f(u.overcast,cloud);
    gl.drawArrays(gl.TRIANGLES,0,3); canvas.dataset.ready='true';
    const preview=options.preview; if(preview) preview.getContext('2d')?.drawImage(canvas,0,0,preview.width,preview.height);
    if(moving && !document.hidden) frame=requestAnimationFrame(paint);
  }
  const refresh=()=>paint(performance.now());
  const resume=()=>{last=performance.now();refresh();};
  const observer=new ResizeObserver(refresh); observer.observe(canvas);
  const lost=()=>{cancelAnimationFrame(frame);canvas.dataset.ready='false';options.onError?.('The graphics connection was interrupted. Reload to restore the light study.');};
  canvas.addEventListener('webglcontextlost',lost);reduce.addEventListener('change',resume);document.addEventListener('visibilitychange',resume);refresh();
  return { update(next:WeatherCondition,state:RoomOptions){
    const now=performance.now();
    // Crossfade large clock seeks as images; keep ordinary playback following
    // the moving sun instead of restarting a dissolve at every clock tick.
    const seek=Math.abs((state.instant?.getTime()??Date.now())-(options.instant?.getTime()??Date.now()))>15*60000;
    if(!disposed && !gl.isContextLost() && state.animated!==false && !reduce.matches && !document.hidden &&
      ((state.scene??'slats')!==material || next!==condition || seek)){
      // The browser may have discarded the drawing buffer. Repaint the last
      // composite (including an interrupted fade) before changing materials.
      paint(last);
      previous??=gl.createTexture();
      if(previous){
        gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,previous);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.copyTexImage2D(gl.TEXTURE_2D,0,gl.RGB,0,0,canvas.width,canvas.height,0);
        gl.activeTexture(gl.TEXTURE0);fadeStart=now;
        if(seek){altitude=undefined;bearing=undefined;}
      }
    }
    if(options.animated!==state.animated)last=now;
    condition=next;options=state;paint(now);
  }, dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();reduce.removeEventListener('change',resume);document.removeEventListener('visibilitychange',resume);canvas.removeEventListener('webglcontextlost',lost);gl.useProgram(null);leaves?.dispose();if(rain){gl.deleteTexture(rain.texture);rain=undefined;}gl.deleteTexture(previous);gl.deleteTexture(texture);gl.deleteProgram(program);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);delete canvas.dataset.ready;} };
}

export function mountWeather(canvas:HTMLCanvasElement, condition:WeatherCondition, options:RoomOptions={}) { return mountRoom(canvas,condition,options).dispose; }
