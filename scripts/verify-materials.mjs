import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

// Exercise the same public entry point a host embeds. Capture from the drawing
// buffer immediately after update, before the browser discards its contents.
const out = resolve(process.env.EVIDENCE_DIR ?? '.amp/in/orb-backup/materials');
mkdirSync(out,{recursive:true});
const build = await Bun.build({entrypoints:['src/weather.ts'],target:'browser',minify:true});
if(!build.success) throw new AggregateError(build.logs,'Weather bundle failed');
const moduleURL='data:text/javascript;base64,'+Buffer.from(await build.outputs[0].arrayBuffer()).toString('base64');
const browser=(...args)=>JSON.parse(execFileSync('agent-browser',['--session','materials','--args','--enable-webgl,--enable-unsafe-swiftshader,--use-angle=swiftshader','--json',...args],{encoding:'utf8',timeout:120000})).data;
const ev=js=>browser('eval',js).result;
async function setup(url){
  const {mountRoom,mountWeather,conditions}=await import(url);
  const names=['bough','slats','spectrum','pendant','vault','canopy','shallows','rain','foil','opal','trellis','washi','cast','oculus','clerestory','louvre'];
  const c=document.createElement('canvas');c.style='width:640px;height:360px;position:absolute;left:-1000px';document.body.append(c);
  document.body.style='margin:0;background:#272826;color:#fff;font:12px Arial';
  let ticks=0;const raf=window.requestAnimationFrame;window.requestAnimationFrame=fn=>{ticks++;return raf(fn)};
  const state={latitude:48.1374,longitude:11.5755,instant:new Date('2026-06-21T10:22Z'),animated:false};
  const room=mountRoom(c,'clear',state);
  window.nightBoundary=()=>{
    const image=document.createElement('canvas');image.width=160;image.height=90;
    const ctx=image.getContext('2d',{willReadFrequently:true});
    function frame(scene,minute){
      room.update('clear',{animated:false,scene,latitude:22.3193,longitude:114.1694,facing:135,instant:new Date(`2026-11-18T15:${minute}:00Z`)});
      ctx.drawImage(c,0,0,160,90);return ctx.getImageData(0,0,160,90).data;
    }
    const before=frame('slats',55),after=frame('slats',56),opal=frame('opal',59),lum=[];
    let change=0;for(let i=0;i<before.length;i+=4){for(let j=0;j<3;j++)change+=Math.abs(after[i+j]-before[i+j]);lum.push(.2126*opal[i]+.7152*opal[i+1]+.0722*opal[i+2]);}
    lum.sort((a,b)=>a-b);return {jump:change/(160*90*3),contrast:lum[14255]-lum[144]};
  };
  window.animateOne=async scene=>{
    const preview=document.createElement('canvas');preview.width=320;preview.height=180;
    room.update('rain',{...state,scene,animated:true,preview});
    const before=preview.toDataURL();await new Promise(r=>setTimeout(r,600));
    const changed=preview.toDataURL()!==before;room.update('clear',{...state,scene});return changed;
  };
  window.sheet=async mode=>{
    const weather=mode.startsWith('weather'),overcast=mode==='mid'||mode==='dawn';
    document.querySelector('main')?.remove();const m=document.createElement('main');document.body.append(m);m.style=`display:grid;grid-template-columns:repeat(${weather?6:4},1fr)`;
    const unique=new Set();
    const start=mode==='weather-a'?0:mode==='weather-b'?6:12;
    for(const scene of weather?names.slice(start,start+6):names){
      for(const condition of weather?conditions:['clear']){
        room.update(condition,{...state,scene,overcast,instant:new Date(mode==='mid'?'2026-06-21T10:23Z':mode==='dawn'?'2026-06-21T03:07Z':'2026-06-21T10:22Z')});
        const img=new Image();img.src=c.toDataURL();unique.add(img.src);await img.decode();img.style='display:block;width:100%';const cell=document.createElement('div');cell.append(img,scene+' / '+(overcast?'overcast':condition));m.append(cell);
      }
    }return {distinct:unique.size,raf:ticks};
  };
  window.cleanupTest=async()=>{c.style.width='200px';await new Promise(r=>setTimeout(r,150));const resized=c.width===300;room.dispose();const dispose=mountWeather(c,'snow',{...state,animated:true});await new Promise(r=>setTimeout(r,200));dispose();const count=ticks;await new Promise(r=>setTimeout(r,100));return {resized,animated:count>0,stopped:ticks===count,disposed:!c.dataset.ready};};
}
try {
  browser('open','about:blank');browser('set','viewport','960','740','2');ev(`(${setup})(${JSON.stringify(moduleURL)})`);
  const night=ev('nightBoundary()');assert.ok(night.jump<2,'Slats jumped when the sun crossed behind the window');assert.ok(night.contrast>10,'Night sky no longer shows the Opal panes');
  for(const mode of ['clear','mid','dawn','weather-a','weather-b','weather-c']){
    ev(`window.result=null; sheet('${mode}').then(r=>window.result=r,e=>window.result={error:String(e)});true`);
    const deadline=Date.now()+120000;let result;
    while(!result && Date.now()<deadline){await Bun.sleep(800);result=ev('window.result');}
    assert.deepEqual(result,{distinct:mode==='weather-c'?24:mode.startsWith('weather')?36:16,raf:0});browser('screenshot','main',`${out}/${mode}.png`);console.log(mode,result);
  }
  for(const scene of ['bough','slats','spectrum','pendant','vault','canopy','shallows','rain','foil','opal','trellis','washi','cast','oculus','clerestory','louvre'])assert.equal(ev(`animateOne('${scene}')`),true,scene);
  assert.deepEqual(ev('cleanupTest()'),{resized:true,animated:true,stopped:true,disposed:true});console.log('PASS: material matrix, animated rain for all 16 scenes, static resize and disposal');
} finally {browser('close')}
