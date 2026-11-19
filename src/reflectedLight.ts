/** Scalar irradiance on the receiver; tint and wall exposure belong to the caller. */
export const reflectedLight = `
float rlSeed(vec2 cell){
  vec3 h=fract(cell.xyx*vec3(.1031,.11369,.13787));
  h+=dot(h,h.yzx+19.19);
  return fract((h.x+h.y)*h.z);
}

float rlField(vec2 q){
  vec2 i=floor(q), f=fract(q);
  f=f*f*(3.-2.*f);
  return mix(mix(rlSeed(i),rlSeed(i+vec2(1,0)),f.x),
             mix(rlSeed(i+vec2(0,1)),rlSeed(i+1.),f.x),f.y);
}

// Compact radial basis for inter-leaf clearance. Contributions overlap before
// thresholding, so adjacent openings can join. No grid-aligned interpolation.
float rlClearance(vec2 q){
  vec2 cell=floor(q), f=fract(q);
  float field=0.;
  for(int j=0;j<2;j++)for(int i=0;i<2;i++){
    vec2 corner=vec2(i,j), id=cell+corner;
    vec2 jitter=vec2(rlSeed(id+17.),rlSeed(id-31.))-.5;
    vec2 d=f-corner-.52*jitter;
    float w=max(0.,1.-dot(d,d)/.53);
    field+=(.18+1.20*rlSeed(id+3.))*w*w*w;
  }
  return field;
}

float canopyFlux(vec2 p,float t,float cloud,float travel){
  float sun=1.-smoothstep(0.,1.,cloud);
  if(sun<=0.)return .14;
  // Oblique projection stretches the interstices down and right. Back foliage
  // has more solar parallax and a wider penumbra than the near screen.
  vec2 q=vec2(dot(p,vec2(.84,-.54)),dot(p,vec2(.54,.84)));
  vec2 wind=vec2(sin(.57*t+3.*q.y),sin(.39*t-2.*q.x));
  vec2 a=q+vec2(.085,-.033)*travel+.005*wind;
  vec2 b=q+vec2(.22,-.095)*travel+.017*wind.yx;
  float cluster=rlField(q*3.+7.);
  a+=.035*vec2(rlField(q*4.3+13.),cluster);
  b+=.085*vec2(cluster,rlField(q*3.1-6.));
  vec2 nearGrid=a*vec2(5.4,10.5), farGrid=b*vec2(2.9,5.0);
  nearGrid.x+=.37*nearGrid.y; farGrid.y-=.24*farGrid.x;
  float nearGap=rlClearance(nearGrid);
  float backGap=rlClearance(farGrid+47.);
  float blur=(1.-sun)*.22;
  float nearOpen=smoothstep(.48-.15*cluster-blur,.80+.16*cluster+blur,nearGap);
  float backOpen=smoothstep(.032,.94+blur,backGap);
  return mix(.14,.022+.93*mix(.81*backOpen,1.,nearOpen),sun);
}

float foilFlux(vec2 p,float t,float cloud,float travel){
  vec2 r=p-vec2(-.08+.14*travel,.12+.055*travel);
  // Finite reflector footprint, tilted across the receiver.
  r.y-=.035*r.x;
  float footprint=exp(-dot(r*r,vec2(3.7,19.)));
  float sun=1.-smoothstep(0.,1.,cloud);
  if(sun<=0.)return .10*footprint;
  // Parameterize the deformed sheet by its receiver hit. A localized bend
  // displaces the source coordinate by A*d*exp(-d²/2w²). Its derivative
  // gathers rays at the bend and borrows them from the adjoining shoulders.
  float phase=.17*t, source=r.y, density=1.;
  for(int i=0;i<4;i++){
    float j=float(i), x=r.x;
    float crease=rlField(vec2(11.*x+.12*phase,2.7*j));
    float center=-.205+.117*j+.037*sin(2.3*j+3.8*x+.4*phase)
                 +.009*sin(12.*x+2.6*j-phase)+.015*(crease-.5);
    float along=x-.32*sin(1.9*j-.7)-.05*sin(phase+j);
    float strength=(.74+1.15*crease)*exp(-along*along*(3.+2.*j));
    float width=.016+.025*(.5+.5*sin(6.5*x+2.*j+.5*phase))+.025*(1.-sun);
    float d=source-center, z=d/width, g=strength*exp(-.5*z*z);
    source+=g*d;
    density*=1.+g*(1.-z*z);
  }
  return footprint*mix(.10,.24+.30*density,sun);
}
`;
