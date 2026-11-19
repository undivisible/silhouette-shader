// One texel is 1/480 of the projected wall height. Positive y points up.
export const paneWidth = 400, paneHeight = 552, paneScale = 480;
type Drop = { x:number; y:number; radius:number; age:number; hold:number; speed:number; drift:number; steer:number; drag:number; turnIn:number; markX:number; markY:number };
type Wake = {x:number; y:number; width:number; born:number};

export class PaneFlow {
  readonly height = new Uint8Array(paneWidth*paneHeight);
  private readonly pinnedFilm: Uint8Array;
  private readonly drops: Drop[] = [];
  private wakes: Wake[] = [];
  private clock = 0;
  private nextBirth = 0;
  private remainder = 0;

  constructor(private readonly random = Math.random) {
    // Fine condensation stays pinned; only the larger mobile caps enter the contact solver.
    for(let i=0;i<2850;i++){
      const r=1.15+this.random()**2*1.65;
      this.stamp(this.random()*paneWidth,this.random()*paneHeight,r,r*(1+.27*this.random()),36+24*r);
    }
    this.pinnedFilm=this.height.slice();
    for(let i=0;i<270;i++) this.spawn(true);
    // A paused first frame is already wet, including a few established wakes.
    for(let i=0;i<60;i++) this.step(1/60,false);
    this.draw();
  }

  private spawn(established:boolean) {
    const r=this.random, x=r()*paneWidth, y=r()*paneHeight;
    const radius=1.15+4.0*Math.pow(r(),3);
    this.drops.push({x,y,radius,age:established?1:0,hold:3.7+r()*1.8,speed:0,drift:0,steer:0,drag:1,turnIn:0,markX:x,markY:y});
  }

  private step(dt:number, storm:boolean) {
    this.clock+=dt;
    this.nextBirth-=dt;
    if(this.nextBirth<=0){
      this.nextBirth+=-Math.log(Math.max(.0001,1-this.random()))/(storm?14:8);
      if(this.drops.length<440) this.spawn(false);
    }
    for(const d of this.drops){
      d.age+=dt; d.radius+=dt*(storm?.12:.075);
      if((d.turnIn-=dt)<=0){
        const deflection=this.random()*2-1;
        d.steer=Math.sign(deflection)*Math.sqrt(Math.abs(deflection))*.77+(storm?.12:0);
        d.drag=.32+this.random()*.98; d.turnIn=.22+this.random()*.65;
      }
      const terminal=Math.min(41,Math.max(0,d.radius-d.hold)*12)*d.drag;
      d.speed+=(terminal-d.speed)*(1-Math.exp(-dt*3));
      d.drift+=(d.steer*d.speed-d.drift)*(1-Math.exp(-dt*5));
      d.x+=dt*d.drift; d.y-=dt*d.speed;
      if(Math.hypot(d.markX-d.x,d.markY-d.y)>1.3){
        this.wakes.push({x:d.x,y:d.y,width:Math.min(2.65,d.radius*.36),born:this.clock});
        d.markX=d.x;d.markY=d.y;
      }
    }
    // Merge only intersecting caps. Volumes add; contact does not restart a clock.
    const ds=this.drops;
    for(let i=ds.length-1;i>=0;i--){
      const a=ds[i];
      if(a.y < -a.radius*2 || a.x < -a.radius || a.x>paneWidth+a.radius){ds.splice(i,1);continue;}
      for(let j=i-1;j>=0;j--){
        const b=ds[j],dx=a.x-b.x, reach=(a.radius*Math.min(1,a.age*2)+b.radius*Math.min(1,b.age*2))*.88;
        if(Math.abs(dx)>reach)continue;
        const dy=a.y-b.y;if(dx*dx+dy*dy>reach*reach)continue;
        const av=a.radius**3,bv=b.radius**3,share=av/(av+bv);
        b.x+=dx*share;b.y+=dy*share;b.radius=Math.cbrt(av+bv);
        b.speed+=(a.speed-b.speed)*share;b.age=Math.max(a.age,b.age);
        ds.splice(i,1);break;
      }
    }
  }

  advance(dt:number,storm:boolean){
    this.remainder+=Math.min(.25,dt);
    if(this.remainder<1/60)return false;
    while(this.remainder>=1/60){this.step(1/60,storm);this.remainder-=1/60;}
    this.draw();return true;
  }

  private stamp(x:number,y:number,rx:number,ry:number,h:number,stretch=0,lean=0){
    // A running drop carries a blunt downhill nose and a thinning uphill neck.
    // Shear the cross sections opposite its velocity so the neck follows the wake.
    const rear=ry*(1+2.8*stretch);
    for(let j=Math.max(0,Math.ceil(y-ry));j<=Math.min(paneHeight-1,y+rear);j++){
      const dy=j-y,u=dy/(dy>0?rear:ry),taper=1-.83*stretch*Math.max(0,u);
      const width=rx*taper,center=x-lean*dy;
      const x0=Math.max(0,Math.ceil(center-width)),x1=Math.min(paneWidth-1,Math.floor(center+width));
      const row=j*paneWidth,v=1-u*u;
      for(let i=x0;i<=x1;i++){
        const cap=v-((i-center)/width)**2;
        if(cap>0)this.height[row+i]=Math.max(this.height[row+i],Math.min(255,h*taper*cap*cap));
      }
    }
  }

  private draw(){
    this.height.set(this.pinnedFilm);
    this.wakes=this.wakes.filter(w=>this.clock-w.born<4);
    for(const w of this.wakes){const fade=1-(this.clock-w.born)/4;this.stamp(w.x,w.y,w.width,w.width*1.45,46*fade*fade);}
    for(const d of this.drops){
      const r=d.radius*Math.min(1,d.age*2),stretch=d.speed/(d.speed+5);
      if(r>.1)this.stamp(d.x,d.y,r*(1-.25*stretch),r*1.12,r*32,stretch,d.drift/(d.speed+3));
    }
  }
}
