/** Insert after hash/noise and wetSurface. Input UV is bottom-up; output is display RGB. */
export const windowStudies = `
// Signed distances here are measured in wall heights, not stretched screen UVs.
float wsPane(vec2 p,vec2 span,float blur){
  vec2 d=abs(p-.5*span)-.5*span;
  float sd=length(max(d,0.))+min(max(d.x,d.y),0.);
  return 1.-smoothstep(-blur,blur,sd);
}

vec3 wsTrellis(vec2 q,float cloud){
  vec2 span=vec2(.98,1.13);
  float depth=smoothstep(0.,span.x,q.x);
  // Two crossed pairs of chisel cuts form each eight-point opening. The
  // rear lip eats into the opening; its projected offset grows down-screen.
  vec2 g=q/vec2(.172,.187);
  g.x+=.13*g.y;
  g+=.14*(vec2(noise(q*5.4),noise(q*6.1+7.))-.5);
  float sum=0.;
  for(int i=0;i<8;i++){
    float k=float(i)+.5;
    vec2 ray=vec2(cos(k*2.4),sin(k*2.4))*sqrt(k/8.)*(.038+.10*depth+.085*cloud);
    vec2 samplePos=g+ray;
    vec2 cell=floor(samplePos);
    vec2 a=fract(samplePos)-.5-.085*(vec2(hash(cell),hash(cell+5.))-.5);
    a.y+=.18*a.x;
    vec2 rear=a+vec2(.017+.045*depth,.041);
    vec2 v=max(abs(a),abs(rear));
    float nearSquare=max(v.x,v.y)-.275;
    float nearDiamond=v.x+v.y-.398;
    float cut=min(nearSquare,nearDiamond)-.07*(hash(cell+21.)-.5);
    float core=1.-smoothstep(-.08-.10*depth,.08+.10*depth,cut);
    float wing=exp(-5.*dot(a-vec2(.16,-.03),a-vec2(.16,-.03)));
    sum+=(.81*core+.22*wing)*(.77+.42*hash(cell+2.));
  }
  float frame=wsPane(q,span,.012+.036*depth+.085*cloud);
  vec2 sky=(q-vec2(.11,.48))*vec2(4.6,2.1);
  float wash=exp(-dot(sky,sky));
  float flank=1.-smoothstep(.24,.94,q.x+.10*noise(q*6.));
  return vec3(.84,.74,.68)*frame*(sum*.125*mix(1.,.46+.82*flank,cloud)+.028*depth+.44*cloud*wash);
}

vec3 wsOpal(vec2 q,float cloud){
  // Three columns of cut sheet: unequal widths, fine came and broad opal faces.
  float milk=noise(q*7.)-.5;
  float blur=.014+cloud*(.087+.040*milk);
  vec3 ivory=vec3(.99,.92,.79), straw=mix(vec3(.98,.80,.47),vec3(.92,.57,.18),cloud);
  vec3 blue=mix(vec3(.54,.69,.98),vec3(.20,.37,.77),cloud);
  vec3 flux=vec3(0.);
  for(int x=0;x<3;x++)for(int y=0;y<3;y++){
    float left=x==0?0.:x==1?.257:.469;
    float w=x==0?.257:x==1?.212:.248;
    float top=y==0?0.:y==1?.317:.655;
    float h=y==0?.317:y==1?.338:.253;
    vec3 dye=(x==2&&y==0)||(x==0&&y==1)?blue:(x==0&&y==2)||(x==2&&y==1)?straw:ivory;
    if(x==1&&y>0)dye=mix(straw,ivory,.43);
    vec2 pane=q-vec2(left,top)-.00065;
    vec2 cover=smoothstep(vec2(-blur),vec2(blur),pane)-smoothstep(vec2(-blur),vec2(blur),pane-vec2(w,h)+.0013);
    flux+=cover.x*cover.y*dye;
  }
  float grain=.60*(noise(q*125.)-.5)+.40*(hash(gl_FragCoord.xy)-.5);
  float falloff=1.-smoothstep(.02,1.2,.87*q.x+.46*q.y);
  return flux*(1.04+.18*milk+.17*grain)*mix(1.,.56+.83*falloff+.23*milk+.10*grain,cloud);
}

vec3 wsCast(vec2 q,float cloud,float incidence){
  vec2 span=vec2(.97,.53),g=q/span*vec2(6.,4.);
  vec2 cell=floor(g),f=fract(g),v=f-.5;
  float inside=wsPane(q,span,.007+.048*cloud);
  float face=wsPane(f,vec2(1.),.085);
  vec2 edge=.5-abs(v);
  float joint=smoothstep(-.025,.125,min(edge.x,edge.y)+.038*(noise(g*6.5)-.5));
  // Each mold has its own folded relief. Incidence changes which ridges
  // focus the beam; the glass does not swim while the clock is stopped.
  vec2 seed=18.*vec2(hash(cell),hash(cell+4.7));
  vec2 r=v+seed;
  vec2 warp=vec2(noise(r*2.4),noise(r*3.1+5.));
  vec2 facet=(r+.21*warp)*vec2(6.,12.);
  facet.y+=.55*facet.x+.37*incidence;
  float emboss=noise(facet*.41);
  float grit=noise(facet*2.6);
  float ridge=smoothstep(.42,.81,noise(facet)+.34*(grit-.5));
  float rim=exp(-38.*abs(min(edge.x,edge.y)-.12));
  float focused=.20+.34*emboss+.61*ridge+.12*rim;
  float relief=.13+.26*ridge+.30*emboss+.10*grit;
  vec2 pool=(q-vec2(.085,.16))*vec2(4.8,3.4);
  float skylight=.44+.96*exp(-dot(pool,pool));
  float mist=wsPane(q+.025,span+.05,.068+.05*cloud);
  float bleed=.17+.22*noise(g*vec2(3.,6.));
  float clearFlux=mix(bleed,focused,face*joint);
  return vec3(.99,.96,.90)*(inside*mix(clearFlux,(.67+.33*joint)*relief*skylight,cloud)+mist*mix(.085,.21*skylight,cloud));
}

vec4 windowStudy(int s,vec2 uv,float t){
  float asp=u_resolution.x/u_resolution.y;
  vec2 p=(uv-.5)*vec2(asp,-1.);
  float angle=u_azimuth-u_facing;
  float travel=clamp((u_projection-.288)/1.10,-1.8,1.8);
  float alt=sin(u_elevation),low=1.-smoothstep(.04,.78,alt);
  int w=int(u_weather+.5);
  float cloud=max(u_overcast,w==1?.48:w==2?.95:w==3?.64:w==4?.91:w==5?.76:0.);
  bool stone=s==10,opal=s==9;
  vec2 origin=stone?vec2(-.73,-.70):opal?vec2(-.69,-.59):vec2(-.61,-.26);
  origin.x*=min(asp,1.78)/1.78;
  float sweep=travel<0.?travel:.46*travel;
  origin+=vec2(.085*sweep,.045*sweep-.10*low);
  vec2 q=p-origin;
  q.x/=(1.+.11*travel);
  q.y-=q.x*((stone?.84:opal?.76:.45)+.06*sweep-.13*low);
  vec3 lens=vec3(0.);
  if(opal&&(w==3||w==4)&&wsPane(q,vec2(.717,.908),.008)>0.){
    lens=wetSurface((q-vec2(.358,.454))*vec2(1.,-1.));
  }
  vec3 flux=stone?wsTrellis(q,cloud):opal?wsOpal(q+lens.xy*vec2(.020,-.020),cloud):wsCast(q,cloud,travel+.65*alt);
  if(opal){
    flux*=clamp(1.+dot(lens.xy,vec2(-.49,.84))-.12*lens.z,.4,1.7);
    if(w==5){
      vec2 snow=q*vec2(22.,18.)-vec2(.27,.81)*t;
      vec2 id=floor(snow),flake=fract(snow)-.5-.56*(vec2(hash(id),hash(id+3.))-.5);
      float crystal=(1.-smoothstep(.05,.18,length(flake)))*smoothstep(.40,.83,hash(id+9.));
      flux=mix(flux,vec3(.96,.97,1.),.67*crystal*wsPane(q,vec2(.717,.908),.004));
    }
  }
  vec3 wall=stone?vec3(.446,.330,.309):opal?vec3(.475,.455,.418):vec3(.431,.414,.401);
  float halo=wsPane(q+.07,stone?vec2(1.12,1.27):opal?vec2(.86,1.05):vec2(1.11,.67),.16+.17*cloud);
  wall=mix(wall,vec3(.301,.313,.335),cloud*(stone?.55:.97));
  if(w==2)wall=mix(wall,vec3(.52,.53,.55),.32);
  if(w==3||w==4)wall*=w==4?vec3(.71,.77,.87):vec3(.91,.94,.98);
  if(w==5)wall+=vec3(.047,.054,.067);
  wall+=.029*(noise(p*3.)-.5)+halo*.045;
  float day=smoothstep(-.15,.09,alt);
  wall=mix(.10*wall+vec3(.023,.035,.058),wall,day);
  float facing=smoothstep(-.35,.45,cos(angle));
  float beam=day*(.46+.54*facing)*mix(1.,opal?.46:stone?.29:.14,cloud);
  vec3 tint=mix(vec3(1.),vec3(1.,.69,.41),low*(1.-.7*cloud));
  float movingSky=noise(p*(w==4?4.1:2.3)+vec2(t*(w==4?.14:.051),0.));
  float air=w==1?.72+.43*movingSky:w==2?.77:w==3?.81+.14*movingSky:w==4?.48+.34*movingSky:w==5?.92:1.;
  vec3 skylight=(1.-day)*vec3(.012,.020,.035)*mix(1.,.65,cloud);
  vec3 rgb=sqrt(max(vec3(0.),wall*wall+flux*(tint*beam*air*.83+skylight)));
  return vec4(rgb*(1.-.045*dot(uv-.5,uv-.5))+.005*(hash(gl_FragCoord.xy)-.5),1.);
}
`;
