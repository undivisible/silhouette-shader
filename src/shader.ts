/** Original procedural fragment body. Uniform angles are radians, clockwise from north. */
export const silhouetteFragment = `
uniform float u_scene;
uniform float u_elevation;
uniform float u_azimuth;
uniform float u_facing;
uniform float u_overcast;

float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
}
float box(vec2 p,vec2 b,float blur) {
  vec2 d=abs(p)-b;
  return 1.0-smoothstep(-blur,blur,max(d.x,d.y));
}
float line(vec2 p,vec2 a,vec2 b,float width,float blur) {
  vec2 pa=p-a, ba=b-a;
  return 1.0-smoothstep(width,width+blur,length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0)));
}
mat2 rotate(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }
float leaves(vec2 p,float t) {
  float shadow=0.0;
  for(int i=0;i<28;i++) {
    float n=float(i), side=mod(n,2.0)*2.0-1.0;
    float stem=floor(n/2.0)/14.0;
    vec2 c=vec2(.05+stem*.34+side*.11, -.55+stem*.92);
    c.x+=sin(stem*8.0+t*.38)*.018;
    c.y+=side*.05;
    vec2 v=rotate(side*.8+sin(n)*.35)*(p-c);
    float d=length(v/vec2(.075+.025*hash(vec2(n,2)),.024));
    shadow=max(shadow,1.0-smoothstep(.75,1.18,d));
    shadow=max(shadow,line(p,vec2(.05,-.55),c,.002,.006)*.8);
  }
  return shadow;
}
vec3 rainbow(float x) {
  return clamp(vec3(1.4-abs(x-.15)*4.0,1.3-abs(x-.5)*4.0,1.4-abs(x-.85)*4.0),0.0,1.0);
}
float caustic(vec2 p,float t) {
  float a=sin(p.x*19.0+sin(p.y*13.0+t*.32)*1.7+t*.18);
  float b=sin(p.y*23.0+sin(p.x*16.0-t*.27)*1.4);
  float c=sin((p.x+p.y)*16.0+sin(p.x*9.0+t*.21));
  return pow(clamp(1.0-abs(a+b+c)*.45,0.0,1.0),13.0);
}
vec4 shade(vec2 uv,float t) {
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=(uv-.5)*vec2(aspect,1.0);
  float altitude=u_elevation;
  float day=smoothstep(-.105,.09,altitude);
  float twilight=smoothstep(-.31,-.04,altitude)*(1.0-smoothstep(-.04,.18,altitude));
  float warm=1.0-smoothstep(.02,.5,altitude);
  float incidence=max(0.0,cos(u_azimuth-u_facing))*max(0.0,cos(altitude));
  float direct=smoothstep(-.014,.045,altitude)*sqrt(incidence)*(1.0-u_overcast*.94);
  vec3 sunlight=mix(vec3(1.0,.94,.78),vec3(1.0,.47,.16),warm);
  vec3 plaster=vec3(.55,.51,.43);
  if(u_scene>3.5 && u_scene<4.5) plaster=vec3(.48,.235,.135);
  if(u_scene>6.5 && u_scene<7.5) plaster=vec3(.21,.30,.40);
  if(u_scene>7.5 && u_scene<8.5) plaster=vec3(.52,.37,.29);
  if(u_scene>9.5 && u_scene<10.5) plaster=vec3(.48,.37,.35);
  vec3 ambient=mix(vec3(.018,.028,.055),plaster,day*.78);
  ambient+=vec3(.10,.055,.065)*twilight;
  ambient=mix(ambient,mix(vec3(.025,.035,.055),plaster*.8,day),u_overcast*.45);
  float grain=noise(p*750.0)*.6+noise(p*240.0)*.4;
  vec3 color=ambient*(.94+grain*.08);
  float lateral=sin(u_azimuth-u_facing);
  vec2 q=p-vec2(.20*aspect+lateral*.25,-.015+sin(altitude)*.06);
  q.x+=q.y*lateral*.38;
  q.y*=.90+sin(max(altitude,0.0))*.30;
  float soft=.004+u_overcast*.075+(1.0-day)*.02;
  float window=box(q,vec2(.31,.345),soft);
  float crossbar=max(1.0-smoothstep(.006,.012,abs(q.x)),1.0-smoothstep(.006,.012,abs(q.y+.005)));
  float light=window*(1.0-crossbar*.94);
  vec3 extra=vec3(0.0);

  if(u_scene<.5) {
    light*=1.0-leaves(q+vec2(.03,.02),t)*.84;
  } else if(u_scene<1.5) {
    vec2 b=q; b.x+=b.y*.27;
    float phase=(b.y+b.x*.12)*24.0;
    float aa=max(fwidth(phase),.008);
    float slat=smoothstep(.23-aa,.23+aa,fract(phase))*(1.0-smoothstep(.98-aa,.98+aa,fract(phase)));
    light=box(b,vec2(.43,.34),soft)*slat;
    light*=1.0-leaves(b*1.1-vec2(.06,.02),t)*.80;
    light*=1.0-line(b,vec2(.18,-.4),vec2(.18,.4),.003,.003)*.8;
  } else if(u_scene<2.5) {
    vec2 r=rotate(-.37)*(q+vec2(.34,.17));
    float band=exp(-pow(r.y/.035,2.0))*box(r,vec2(.14,.12),.055);
    extra=rainbow(r.x/.28+.5)*band*1.35;
    light*=.9;
  } else if(u_scene<3.5) {
    light*=.90;
    for(int i=0;i<15;i++) {
      float n=float(i);
      vec2 c=vec2(hash(vec2(n,1.0))-.5,hash(vec2(n,4.0))-.5)*vec2(1.25,.85);
      c+=vec2(sin(t*.17+n),cos(t*.13+n))*.025;
      vec2 r=rotate(n+t*.07)*(q-c);
      float spark=exp(-dot(r/vec2(.042,.014),r/vec2(.042,.014)));
      extra+=rainbow(fract(n*.31)+r.x*5.0)*spark*.8;
    }
  } else if(u_scene<4.5) {
    float arch=max(abs(q.x)-.31,q.y>.08?length(vec2(q.x,q.y-.08))-.31:-q.y-.34);
    light=(1.0-smoothstep(-soft,soft,arch))*(1.0-crossbar*.93);
    float vase=box(q-vec2(.13,-.25),vec2(.038,.07),.006);
    vase=max(vase,box(q-vec2(.13,-.17),vec2(.014,.04),.003));
    light*=1.0-vase*.9;
    light*=1.0-leaves((q-vec2(-.12,.10))*1.7,t)*.42;
  } else if(u_scene<5.5) {
    light=0.0;
    for(int i=0;i<38;i++) {
      float n=float(i);
      vec2 c=vec2(hash(vec2(n,7.0))-.5,hash(vec2(n,9.0))-.5)*vec2(aspect*1.5,1.4);
      c+=vec2(sin(t*.23+n*.9),cos(t*.17+n))*.023;
      vec2 v=rotate(n*.7+.4)*(p-c);
      float radius=.022+.065*hash(vec2(n,11));
      float d=length(v/vec2(radius*1.7,radius));
      light+=exp(-pow(d,4.0))*(.30+.70*hash(vec2(n,13)));
    }
    light=min(light,1.4)*(.7+sin(altitude)*.3);
  } else if(u_scene<6.5) {
    vec2 water=p*vec2(1.0,1.0+pow(uv.y,2.0)*4.0);
    float ripple=caustic(water,t);
    light=(.1+ripple*.9)*mix(1.0,.18,uv.y);
    extra=vec3(.06,.09,.09)*noise(water*12.0+t*.03);
  } else if(u_scene<7.5) {
    vec2 cell=q*vec2(37.0,26.0);
    vec2 id=floor(cell), f=fract(cell)-.5;
    vec2 center=(vec2(hash(id),hash(id+4.0))-.5)*.65;
    vec2 d=(f-center)/vec2(.23,.32);
    float bead=exp(-dot(d,d)*5.0)*step(.38,hash(id+12.0));
    float rim=exp(-pow(length(d)-.85,2.0)*80.0)*step(.38,hash(id+12.0));
    vec2 refract=q+vec2(d.x,d.y)*bead*.016;
    light=box(refract,vec2(.34,.34),soft)*(1.0-crossbar*.9);
    light*=1.0-bead*.66;
    extra+=vec3(.7,.8,.9)*rim*.21*window;
    float trail=pow(max(0.0,sin(q.x*180.0+sin(q.y*17.0-t*.18)*.8)),22.0);
    light*=1.0-trail*.12;
  } else if(u_scene<8.5) {
    vec2 r=rotate(-.45)*q;
    float fold=r.x*21.0+sin(r.y*12.0+t*.15)*2.3+sin(r.y*27.0-r.x*5.0)*.45;
    float ribbons=pow(.5+.5*sin(fold),22.0);
    float broad=pow(.5+.5*sin(fold+.8),4.0);
    light=(ribbons*.65+broad*.15)*exp(-dot(q*vec2(1.1,2.0),q*vec2(1.1,2.0))*2.3);
    extra=vec3(.32,.11,.025)*broad*.16;
  } else if(u_scene<9.5) {
    vec2 grid=(q+vec2(.31,.345))*vec2(7.0,5.8);
    vec2 id=floor(grid), f=fract(grid);
    float lead=1.0-smoothstep(.018,.04,min(min(f.x,1.0-f.x),min(f.y,1.0-f.y)));
    vec3 tint=mix(vec3(.55,.72,.98),vec3(1.0,.81,.43),hash(id));
    tint=mix(tint,vec3(.96,.9,.8),step(.45,hash(id+7.0)));
    light=window*(1.0-lead*.8)*.40;
    extra=tint*window*(1.0-lead)*.48;
  } else if(u_scene<10.5) {
    vec2 lattice=rotate(.10)*q*19.0;
    vec2 f=abs(fract(lattice)-.5);
    float opening=pow(max(0.0,1.0-(f.x+f.y)*2.5),.6);
    light=box(q,vec2(.47,.36),soft)*smoothstep(.03,.25,opening);
    light*=1.0-leaves(q*1.2,t)*.6;
  } else {
    vec2 f=abs(fract((q+vec2(.31,.345))*vec2(9.6,7.2))-.5);
    float frame=smoothstep(.43,.48,max(f.x,f.y));
    light=window*(1.0-frame*.85)*(.7+noise(q*80.0)*.18);
    light*=1.0-leaves(q*1.1,t)*.22;
  }

  color+=(sunlight*light+extra)*direct*.67;
  float halo=exp(-dot(q/vec2(.53,.54),q/vec2(.53,.54)));
  color+=sunlight*halo*direct*.06;
  color*=1.0-.14*length((uv-.5)*vec2(.85,1.0));
  color+=vec3((hash(gl_FragCoord.xy)-.5)*.008);
  color=pow(max(color,vec3(0.0)),vec3(.92));
  return vec4(color,1.0);
}
`;
