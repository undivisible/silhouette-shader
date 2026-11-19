import { rainOptics } from './rainOptics';
import { reflectedLight } from './reflectedLight';
import { windowStudies } from './windowStudies';

/** Projected light on a stationary wall, in units of wall height. */
export const silhouetteFragment = `
uniform float u_scene, u_elevation, u_azimuth, u_facing, u_projection, u_overcast, u_weather;
uniform float u_authored;
uniform sampler2D u_mask;
uniform sampler2D u_previous;
uniform float u_previousOpacity;
float hash(vec2 p){vec3 a=fract(p.xyx*vec3(.1031,.1030,.0973));a+=dot(a,a.yzx+33.33);return fract((a.x+a.y)*a.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
${rainOptics}
${reflectedLight}
${windowStudies}
vec3 lensAt(vec2 q,float pane,int s,int weather,float shear){
  bool wet=weather==3||weather==4;
  if(pane>=0. || !(s==7 || (wet&&(s==0||s==1||s==2||s==3||s==9||s==13))))return vec3(0.);
  // The crossbar sits behind a continuous exterior sheet, not in its drainage path.
  vec3 lens=wetSurface(vec2(q.x,q.y+shear*q.x));
  return lens*smoothstep(0.,.012,-pane)*(s==9?.19:s==2?.45:s==7?1.:.77);
}
float mask(float d,float b){return 1.-smoothstep(-b,b,d);}
// Visible fraction of a circular source cut by a straight silhouette edge.
float sunEdge(float d,float radius){float x=clamp(d/max(radius,.0001),-1.,1.);return (acos(x)-x*sqrt(max(0.,1.-x*x)))/3.14159265;}
float cornerAngle(vec2 v,float z){return atan(v.x*v.y,z*sqrt(dot(v,v)+z*z));}
float apertureAngle(vec2 q,vec2 halfSize,float z){vec2 lo=q-halfSize,hi=q+halfSize;return (cornerAngle(hi,z)+cornerAngle(lo,z)-cornerAngle(vec2(lo.x,hi.y),z)-cornerAngle(vec2(hi.x,lo.y),z))*.159155;}
float rect(vec2 p,vec2 size){vec2 d=abs(p)-size;return length(max(d,0.))+min(max(d.x,d.y),0.);}
float segment(vec2 p,vec2 a,vec2 b){vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.));}
vec2 turn(vec2 p,float a){return mat2(cos(a),sin(a),-sin(a),cos(a))*p;}
vec3 spectrum(float n){return .56+.43*cos(6.28*(clamp(n,0.,1.)*.78+vec3(0.,.68,.36)));}
float plant(vec2 p,float t,bool broad){
  float s=0.;
  if(broad){
    for(int i=0;i<3;i++){
      float n=float(i);vec2 c=i==0?vec2(-.28,-.24):i==1?vec2(-.073,-.07):vec2(-.15,.24);
      c+=.007*vec2(sin(.52*t+n),cos(.41*t+n));vec2 foot=vec2(-.25,-.46);
      vec2 stem=p;stem.x+=.044*sin(3.14*clamp((p.y-foot.y)/(c.y-foot.y),0.,1.));
      s=max(s,mask(segment(stem,foot,c)-.004,.007));
      vec2 v=turn(p-c,i==1?-.29:-.08)/(i==1?.26:.20);
      float spine=v.y-.18*sin(3.14*clamp(v.x,0.,1.));s=max(s,mask(segment(vec2(v.x,spine),vec2(0),vec2(.94,0))-.028,.034));
      for(int j=0;j<7;j++){
        float k=float(j),side=mod(k,2.)*2.-1.,h=.05+.094*k;
        vec2 root=vec2(h,.18*sin(3.14*h));vec2 l=v-root;
        float len=.44-.18*h+.07*sin(k*4.+n);float u=l.x/len;
        float arc=side*(.40-.17*h)*sin(2.15*clamp(u,0.,1.));
        float blade=abs(l.y-arc)-(.15+.055*(1.-h))*sin(3.14*clamp(u,0.,1.));
        s=max(s,mask(max(blade,max(-u,u-1.)*.3),.033));
      }
    }return s;
  }
  for(int i=0;i<5;i++){
    float n=float(i), dir=mod(n,2.)*2.-1.;vec2 base=vec2(-.17,-.40);
    vec2 tip=vec2(-.13+.32*hash(vec2(n,4)), -.17+n*.119);
    tip+=vec2(.007*sin(.68*t+n),.004*sin(.37*t+n));
    vec2 stem=p;stem.x+=.045*sin(3.14*clamp((p.y-base.y)/(tip.y-base.y),0.,1.));
    s=max(s,.72*mask(segment(stem,base,tip)-.003,.010));
    for(int j=0;j<9;j++){
      float k=float(j),v=k/9.,side=mod(k,2.)*2.-1.,seed=hash(vec2(n,k));float h=.57+.43*v;vec2 c=mix(base,tip,h);c.x-=.045*sin(3.14*h);
      vec2 blade=turn(p-c,side*(.25+.68*seed)+dir*.30);blade.x*=side;
      vec2 f=blade/vec2(.052+.040*seed,.012+.009*seed);
      float d=length(vec2((f.x-.5)*2.,f.y+.75*f.x*f.x))-.99;
      s=max(s,(.65+.3*seed)*mask(d,.42+.65*seed));
    }
  }return s;
}
float water(vec2 p,float t){
  p+=.38*vec2(sin(p.y*1.7+t*.43),cos(p.x*1.3-t*.31));vec2 id=floor(p),f=fract(p);float a=8.,b=8.;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
    vec2 i=vec2(x,y),c=i+.5+.38*sin(vec2(hash(id+i),hash(id+i+23.))*6.28+t*.32)-f;
    float d=dot(c,c);b=min(b,max(a,d));a=min(a,d);
  }return exp(-6.*(sqrt(b)-sqrt(a)));
}
vec4 radiance(vec2 uv,float t){
  int s=int(u_scene+.5);float asp=u_resolution.x/u_resolution.y;
  if(s==9||s==10||s==12)return windowStudy(s,uv,t);
  vec2 p=(uv-.5)*vec2(asp,1.);float facing=u_azimuth-u_facing,alt=u_elevation;
  float travel=(u_projection-.288)/1.10;
  float leftward=(s==0||s==2||s>=9)?-1.:1.;float side=s>=9?-.19:.16*leftward;
  vec2 q=p-vec2((side-(s==1?.06:.021))*min(asp,1.78)+.065*sin(facing),-.12+.07*(.8-sin(alt)));
  q.y-=q.x*(s==9?-.79:s==10?-.66:.43*leftward);
  vec2 extent=vec2(s==1?.30:s>=9?.35:.255,s>=9?.49:.316);
  if(s>=9) q.y-=.13;
  if(s==11){q.x-=.034;extent=vec2(.331,.422);q.y-=.017;}
  int weather=int(u_weather+.5);
  float sky=weather==1?.56:weather==2?.87:weather==3?.53:weather==4?.84:weather==5?.60:0.;
  float cloud=max(sky,u_overcast),pane=rect(q,extent);
  float b=(s==11?.019:.006)+cloud*(.096+.08*(1.-smoothstep(.03,.4,alt)))+.002*(1.+q.y);float d=pane;
  vec3 wall=vec3(.477,.457,.433),lit=vec3(.986,.964,.927);
  float tr=1.;vec3 scatter=vec3(0.);float breeze=.006*sin(t*.56)+.003*sin(t*1.31);
  vec3 lens=vec3(0.);
  if(u_authored<.5 && s<12){lens=lensAt(q,pane,s,weather,.43*leftward);q+=lens.xy*.013;}
  if(u_authored>.5 && s<12 && s!=4){
    float sweep=travel;
    vec2 pivot=s==1?vec2(180.,110.):s==5||s==8?vec2(147.,82.):vec2(95.,80.);
    vec2 pix=vec2(147.,82.5)+p*vec2(165.,-165.);
    pix=pivot+(pix-pivot-vec2((s==1?-24.:s==5?45.:17.)*sweep,8.*sweep+9.*(sin(alt)-.89)))/vec2(1.+.22*sweep,1.+.05*sweep);
    vec2 wind=pix*.028-vec2(.23,.065)*t;
    vec2 gust=vec2(noise(wind),noise(wind*1.31+6.))-.5;
    float flex=s==1?1.-smoothstep(55.,154.,pix.y):s==0?smoothstep(90.,140.,pix.x):1.;
    vec2 flow=(s==11||s==10)?vec2(0.):gust*flex*(s==5?5.:s==8?3.:7.);
    if(s==1)flow=vec2(0.);
    if(s==8){flow+=vec2(2.1,4.5)*(noise(p*8.+t*.12)-.5)+vec2(.7,1.9)*(noise(p*23.+t*.16)-.5);}
    vec2 coord=(pix+flow)/vec2(294.,165.);vec3 art=texture(u_mask,coord).rgb;
    if(s==5){coord=fract(coord*.82+vec2(.09,.08));art=texture(u_mask,coord).rgb;}
    vec2 parallax=vec2(sweep, sin(alt)-.89)*(s==11?1.5:s==5?17.:s==8?5.:3.2);
    vec2 lee=vec2(noise(wind*.68+13.),noise(wind*.87-7.))-.5;
    vec2 distant=(pix+parallax+flow+((s==10||s==11)?vec2(0.):lee*flex*2.2))/vec2(294.,165.);
    if(s==1)distant=coord;
    if(s==5)distant=fract(distant*.82+vec2(.09,.08));
    float farLayer=textureLod(u_mask,distant,1.1+1.4*abs(sweep)+2.2*cloud).g;
    art.r=1.-(1.-art.r)*(1.-farLayer);
    if(s==0||s==1||s==11){
      vec2 center=s==0?vec2(98.5,105.):s==1?vec2(180.,110.):vec2(95.,79.);
      q=(pix-center)*vec2(1.,-1.)/165.;q.y-=q.x*(s==1?.42:-.405)*(1.+.13*sweep);b+=.004+.004*abs(sweep);
      extent=s==1?vec2(.299,.32):s==0?vec2(.258,.317):vec2(.333,.432);d=rect(q,extent);pane=d;
      lens=lensAt(q,pane,s,weather,(s==1?.42:-.405)*(1.+.13*sweep));
      vec2 bend=lens.xy*.013;q+=bend;coord+=bend*vec2(165./294.,-1.);distant+=bend*vec2(165./294.,-1.);
      if(s==0 && dot(bend,bend)>0.)art.r=1.-(1.-texture(u_mask,coord).r)*(1.-textureLod(u_mask,distant,1.1+1.4*abs(sweep)+2.2*cloud).g);
    }
    if(s==0){tr=(1.-.32*art.r)*(1.-.28*max(mask(abs(q.x-.027)-.007,b),mask(abs(q.y-.087)-.006,b)));tr*=1.-.42*mask(rect(q-vec2(-.065,-.30),vec2(.055,.07)),.008)*(1.-.73*mask(rect(q-vec2(-.065,-.30),vec2(.027,.033)),.008));scatter+=vec3(.09,.08,.07)*exp(-abs(d)*16.);}
    if(s==1){
      // Integrate visibility across the solar disc at three occluder depths.
      float flux=0.;float radius=.0035+.006*(1.-smoothstep(.1,1.,alt))+.020*cloud;
      for(int i=0;i<12;i++){float k=float(i)+.5;vec2 ray=vec2(cos(k*2.4),sin(k*2.4))*sqrt(k/12.)*radius;
        vec2 slat=q+ray*.55;float slot=1.-(.36+.10*smoothstep(-.20,.22,q.x))*mask(abs(fract(slat.y*34.+.018*sin(slat.x*8.))-.5)-.089,.095);
        float leaf=texture(u_mask,coord+ray*vec2(.9,1.7)).r;
        float back=textureLod(u_mask,distant+ray*vec2(1.9,3.4),1.7+cloud).g;
        flux+=slot*(1.-.77*leaf)*(1.-.64*back)*mask(rect(q+ray,extent),.007);
      }
      float plaster=.52*noise(p*14.)+.31*noise(p*39.)+.17*noise(p*143.);
      float bounce=exp(-max(0.,rect((q-vec2(.038,.012))*vec2(.76,1.12),extent))*13.);
      float reveal=exp(-abs(q.x-extent.x)*10.)*exp(-pow((q.y-.13)*2.6,2.));
      scatter+=vec3(.081,.070,.052)*bounce*(.55+.45*reveal);b+=.005;
      wall=vec3(.43,.374,.315)+.026*(plaster-.5)+vec3(.063,.058,.051)*bounce+vec3(.045,.039,.031)*reveal;
      lit=vec3(1.055,1.026,.952);tr=flux/12.*(1.-.23*mask(abs(q.x+.18)-.003,.006));
    }
    if(s==10){wall=vec3(.464,.344,.322);d=-1.;tr=art.r;}
    if(s==11){wall=vec3(.445,.342,.261);lit=vec3(.985,.885,.695);float core=exp(-pow((q.x-.035)/.095,2.));tr=.94-.34*art.r-.23*farLayer+.18*core;b+=.008;}
  }else if(s==0){tr-=.22*max(mask(abs(q.x-.027)-.006,b),mask(abs(q.y-.087)-.005,b));tr*=1.-.53*plant(turn(q-vec2(.174,.13),2.27)*2.45,t,false);scatter+=vec3(.092,.076,.065)*exp(-abs(d)*16.);
    tr*=1.-.52*mask(rect(q-vec2(-.065,-.30),vec2(.056,.070)),.006)*(1.-.75*mask(rect(q-vec2(-.065,-.30),vec2(.030,.040)),.008));}
  if(s==1&&u_authored<.5){wall=vec3(.46,.399,.337);lit=vec3(.998,.945,.846);float stripe=abs(fract((q.y+.0006*sin(q.x*15.))*34.)-.5);
    tr=(1.-.59*smoothstep(.38,.49,stripe))*(1.-.57*plant(q,t,true))*(1.-.32*mask(abs(q.x+.19)-.003,.005));}
  if(s==2){float wedge=abs(q.y+.88*q.x+.025)-.025*max(0.,1.-abs(q.x-.08)*6.);tr-=.40*mask(wedge,.004)*mask(abs(q.x-.08)-.175,.004);
    vec2 r=turn(p-vec2(-.70+.16*travel,-.31+.19*(sin(alt)-.89)),-.28);r.x+=.54*r.y*r.y;
    for(int i=0;i<9;i++){float band=(float(i)+.5)/9.;vec2 v=(r-vec2((band-.5)*.16,0.))/vec2(.040+.015*band,.175);scatter+=spectrum(1.-band)*exp(-v.x*v.x-pow(abs(v.y),4.))*.29;}}
  if(s==3){tr-=.27*max(mask(abs(q.x+.028)-.005,b),mask(abs(q.y-.07)-.005,b));tr*=1.-.19*mask(segment(q,vec2(.034,.31),vec2(.034+breeze,.105))-.001,.002);
    vec2 swing=vec2(.018*sin(.83*t)+.008*sin(.42*t),.009*cos(.83*t));
    for(int i=0;i<20;i++){float n=float(i),a=n*2.4;float facet=hash(vec2(n,8.));vec2 c=vec2(cos(a)*.44,sin(a)*.36)+vec2(.11,.14)+swing*(.5+facet)+.10*vec2(hash(vec2(n,5.))-.5,facet-.5);vec2 r=turn(q-c,a+facet*.6+swing.x*2.)/vec2(.021+.045*facet,.011+.009*facet);scatter+=exp(-dot(r,r))*spectrum(r.x*.64+.5)*(.28+.57*facet);}}
  if(s==4){wall=vec3(.445,.303,.243);lit=vec3(1.,.91,.81);d=max(d,q.y>.055?length(q-vec2(0,.055))-.255:-1.);
    tr-=.38*max(mask(abs(q.x-.017)-.005,b),mask(abs(q.y-.047)-.006,b));
    float vase=mask(rect(q-vec2(.022,-.273),vec2(.044,.087)),.008);vase=max(vase,mask(rect(q-vec2(.022,-.168),vec2(.018,.036)),.004));lit=mix(lit,vec3(.92,.64,.33),vase*.8);
    vec2 branch=q/(extent*vec2(2.,-2.))+.5+vec2(.04*travel,.006*sin(t*.67+q.x));
    vec2 shade=textureLod(u_mask,branch,2.+cloud*3.).rg;
    tr*=1.-.60*min(1.,shade.x+shade.y);}
  if(s==5){wall=vec3(.39,.39,.40);d=-1.;tr=canopyFlux(p,t,cloud,travel);}
  if(s==6){wall=vec3(.59,.581,.58);d=-1.;vec2 plane=vec2(p.x,1.)/(.19+pow(1.-uv.y,1.3));float wave=water(plane*vec2(7.,27.),t);tr=(.22+.94*wave)*pow(1.-uv.y,1.55);}
  if(s==7){wall=vec3(.275,.33,.412);lit=vec3(.89,.891,.878);
    tr=.91+.09*noise(q*6.5)-.38*mask(abs(q.y-.067)-.009,.008+.016*cloud);}
  if(s==8){wall=vec3(.627,.587,.574);lit=vec3(1.,.871,.745);d=-1.;tr=foilFlux(p,t,cloud,travel);}
  if(s==9){vec2 g=(q+extent)*vec2(4.3,3.);vec2 id=floor(g),f=fract(g);float tile=mod(id.x+2.*id.y,4.);lit=tile<1.?vec3(.77,.817,.902):tile<2.?vec3(.99,.865,.624):vec3(.964,.925,.85);tr-=.14*mask(min(min(f.x,1.-f.x),min(f.y,1.-f.y))-.01,.026);}
  if(s==10&&u_authored<.5){wall=vec3(.464,.344,.322);vec2 fan=p-vec2(-.21*min(asp,1.78)+.06*sin(facing),.03);fan.x+=fan.y*.26;fan.y+=fan.x*.66;
    d=rect(fan,vec2(.45,.61));b+=.062;vec2 v=fan*vec2(4.8,4.75);v+=.077*sin(v.yx*2.1+t*.11);
    vec2 f=abs(fract(v)-.5);float hole=min(max(f.x,f.y)-.245,(f.x+f.y)-.40);float depth=smoothstep(-.4,.42,fan.x);
    tr=(.87-.18*depth)*mask(hole,.065+.34*depth)+.11*depth;}
  if(s==11&&u_authored<.5){wall=vec3(.445,.342,.261);lit=vec3(.985,.885,.695);vec2 f=abs(fract(q*vec2(6.4,5.4))-.5);
    float timber=smoothstep(.32,.51,max(f.x,f.y));float post=mask(abs(q.x)-.046,.025);
    float core=exp(-pow((q.x-.018)/.125,2.));float lip=mask(abs(q.x-.014)-.012,.012);
    tr=.95-.16*timber-.075*post+.14*core+.072*lip+.022*(noise(q*vec2(150.,65.))-.5);b+=.009;
    vec2 neck=q-vec2(-.247,-.285);float bottle=max(mask(length((q-vec2(-.247,-.367))/vec2(.053,.064))-1.,.13),mask(rect(neck,vec2(.020,.024)),.006));tr-=.42*bottle;}
  if(s>=12){
    float shift=travel;
    vec2 center=s==12?vec2(-.15,-.27):s==13?vec2(-.15,-.15):s==14?vec2(-.06,.18):vec2(.18,-.20);
    center+=vec2((s==15?-.15:.15)*shift,-.045*shift);
    q=(p-center)/vec2(1.+.19*shift,1.);q.y-=q.x*(s==14?-.11:s==15?.39:-.41);
    extent=s==12?vec2(.475,.27):s==14?vec2(.72,.14):vec2(.355,.285);
    pane=s==13?(length(q/vec2(.397,.302))-1.)*.30:rect(q,extent);d=pane;b=.005+.05*cloud;
    if(s==13){lens=lensAt(q,pane,s,weather,-.41);q+=lens.xy*.013;}
    if(s==12){vec2 cell=(q+extent)*vec2(6.1,7.6);vec2 edge=abs(fract(cell)-.5);float seam=smoothstep(.37,.49,max(edge.x,edge.y));float folds=noise(q*vec2(85.,110.)+.35*sin(q.yx*130.+t*.17));tr=(.29+.72*folds+.22*sin(folds*26.))*(1.-.83*seam);}
    if(s==13||s==14){wall=s==13?vec3(.665,.506,.686):vec3(.56,.644,.627);lit=s==13?vec3(1.,.80,.43):vec3(.953,.965,.92);tr=1.;
      vec2 st=q/((s==13?vec2(.397,.302):extent)*vec2(2.,-2.))+.5;
      vec2 sway=vec2(.011*sin(t*.63+st.y*2.1),.014*sin(t*.86+st.x*3.2));
      vec2 nearUV=st+sway*(s==13?st.x:st.y)+vec2(.055*shift,0.);
      vec2 farUV=st-.68*sway.yx+vec2(.105*shift,-.014*shift);
      float nearShadow=textureLod(u_mask,nearUV,(s==14?3.2:1.1)+cloud*3.).r;
      float farShadow=textureLod(u_mask,farUV,(s==14?3.9:2.)+cloud*3.).g;
      tr=(1.-(s==13?.96:.52)*nearShadow)*(1.-(s==13?.84:.41)*farShadow);
      tr*=1.-(s==14?.40:.33)*mask(s==14?abs(fract(q.x*2.75+.5)-.5)/2.75-.003:abs(q.x)-.004,b);
    }
    if(s==15){wall=vec3(.57,.414,.182);lit=vec3(1.,.80,.43);tr=(1.-.95*mask(abs(q.x)-.022,.004))*(1.-.90*mask(abs(fract(q.y*18.)-.5)-.115,.065));scatter+=vec3(.035,.022,.006)*exp(-abs(d)*18.);}
  }
  float day=smoothstep(-.18,.11,alt),warm=1.-smoothstep(-.04,.50,alt);
  if(weather!=0){
    float air=noise(q*3.7+vec2(t*.045,0));
    tr=mix(tr,.77,sky*(weather==2?.93:.55));
    tr*=1.-sky*(.17+.32*air);
    lit=mix(lit,vec3(.84,.89,.93),sky*.83);
    wall=mix(wall,vec3(.32,.36,.40),sky*(weather==4?.92:.59));
    float glass=mask(max(pane,d),.004);
    if(s==11){
      float fiber=.7*noise(q*vec2(83.,320.))+.3*noise(q*vec2(170.,73.));
      tr=mix(tr,.76+.13*fiber,.58*sky);lit=mix(lit,vec3(.86,.78,.62),.58);
      tr+=.13*sky*(noise(q*vec2(3.6,2.2)+vec2(t*.095,t*.026))-.5);
      tr-=sky*.13*exp(-abs(q.y+extent.y)*12.)*(.6+noise(q*17.));
    }else if(s==12||s==14||s==15){float mist=noise(q*vec2(8.,13.)+t*.08);tr=mix(tr,.58+.25*mist,sky*(s==15?.12:.42));lit=mix(lit,vec3(.72,.78,.79),sky*(s==15?.46:.79));}
    else if(s==8){tr*=.53+.32*air;lit=mix(lit,vec3(.81,.72,.66),sky);}
    else if(s==6){vec2 w=q*vec2(11.,20.);float rings=sin(length(fract(w)-.5)*31.-t*2.8);tr+=.055*rings*sky*(1.-uv.y);}
    else if(s==5){tr=mix(tr,.58+.23*noise(q*4.+t*.09),sky*.55);}
    else if(s==4||s==10){tr*=.78+.22*air;lit=mix(lit,wall,.16*sky);}
    else if(weather==5){
      vec2 g=q*vec2(20.,17.);g.y+=t*.65;g.x+=.26*sin(g.y*.85+t*.41);vec2 id=floor(g);
      float flake=mask(length(fract(g)-.5-(vec2(hash(id),hash(id+3.))-.5)*.52)-.12,.072);
      float sill=mask(q.y+extent.y-.019-.012*noise(q*18.),.008);
      tr+=glass*(flake*.67+sill*.49)*(s==9?.24:1.);lit=mix(lit,vec3(1.),glass*sill*.7);
    }else if(weather==2){tr+=glass*.22*noise(q*5.+t*.02);}
  }
  float direct=smoothstep(-.018,.055,alt)*pow(max(0.,cos(facing)*cos(alt)),.18);
  if(u_authored>.5||s>=12)direct=max(direct,.77*smoothstep(.02,.49,alt));
  float beam=.075*(1.-day)+direct*(1.-.85*u_overcast)*(1.-.65*sky)+sky*.14;
  wall+=.027*(noise(p*2.6)-.5)+.022*(noise(p*5.3)-.5);
  vec3 ambient=mix(.10*wall+vec3(.023,.035,.058)+sky*vec3(.008,.012,.020),wall*(1.-.23*cloud),day);
  vec3 tint=mix(vec3(.44,.60,.91),mix(vec3(1.),vec3(1.,.59,.31),warm),day);
  if(cloud>0.){
    if(s==12){wall=mix(wall,vec3(.33,.35,.38),cloud);tr=mix(tr,.30+.22*noise(q*13.),cloud*.67);}
    if(s==13||s==14){lit=mix(lit,s==13?vec3(.84,.67,.78):vec3(.72,.82,.83),cloud*.86);}
    if(s==15)lit=mix(lit,vec3(.84,.65,.31),cloud*.67);
    if(s==2||s==3)scatter*=pow(1.-cloud,3.);
    if(s==9)lit=mix(lit,vec3(dot(lit,vec3(.3,.59,.11))),cloud*.34);
    if(s==11){tr=mix(tr,.82,cloud*.82);lit=mix(lit,vec3(.90,.74,.53),cloud*.68);}
    if(s==7)lit=mix(lit,vec3(.47,.61,.79),cloud*.74);
  }
  float paneDepth=(s==11?.95:s==10?1.36:s==15?.48:.72)+.46*smoothstep(-.4,.4,q.y+.33*q.x);
  float sourceRadius=.00465*paneDepth/max(.29,abs(cos(alt)))+.004*paneDepth;
  float aperture=sunEdge(d,b+sourceRadius);
  bool openField=s==5||s==6||s==8||s==10;
  float indirect=openField?.045:apertureAngle(q-vec2(.038,-.021),extent,.13+.065*paneDepth);
  float slope=dot(lens.xy,vec2(-.46,.89));
  tr+=.25*max(slope,0.)-.31*max(-slope,0.)-.042*lens.z;
  float diffuse=cloud*(s==6?.50:s==5?.44:s==8?.29:s==11?.27:s==9?.34:.13)*(.56+.44*day);
  vec3 body=pow(max(ambient,vec3(0.)),vec3(2.2));
  vec3 light=max(vec3(0.),pow(lit,vec3(2.2))-pow(wall,vec3(2.2)));
  float relief=noise(p*145.)-.5;
  vec3 energy=body+light*(tint*beam+diffuse)*(max(0.,tr)*aperture+.19*indirect)*(1.+relief*.035)+scatter*beam;
  // Low-energy scattered light outside a bright reveal, kept separate from
  // direct visibility so it does not blur droplets, paper fibers or silhouettes.
  if(!openField)energy+=light*tint*.055*beam*exp(-max(d,0.)/(.012+.012*paneDepth))*(1.-aperture);
  // Compress the brightest channel together with its neighbours; clipping each
  // channel independently turns overlapping dispersed wavelengths into slabs.
  float peak=max(energy.r,max(energy.g,energy.b)),knee=.80;
  if(peak>knee)energy*=(knee+(1.-knee)*(1.-exp(-(peak-knee)/(1.-knee))))/peak;
  vec3 color=pow(max(energy,vec3(0.)),vec3(1./2.2));color*=1.-.065*dot(uv-.5,uv-.5);color+=(hash(gl_FragCoord.xy)-.5)*.009;
  return vec4(color,1.);
}
vec4 lightAt(vec2 uv,float t){
  vec4 center=radiance(uv,t);
  float haze=max(u_overcast,u_weather==2.?.86:0.);
  float width=haze*(.004+.025*(1.-smoothstep(0.,.25,u_elevation)));
  if(width<.001) return center;
  vec2 stepSize=width*vec2(u_resolution.y/u_resolution.x,1.);
  return .36*center+.16*(radiance(uv+stepSize,t)+radiance(uv-stepSize,t)+radiance(uv+stepSize*vec2(-1,1),t)+radiance(uv+stepSize*vec2(1,-1),t));
}
vec4 shade(vec2 uv,float t){
  vec4 light=lightAt(uv,t);
  if(u_previousOpacity<=0.)return light;
  return mix(light,texture(u_previous,uv),u_previousOpacity);
}`;
