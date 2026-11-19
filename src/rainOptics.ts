import { paneScale } from './paneFlow';

export const rainOptics = `
uniform sampler2D u_film;
vec3 wetSurface(vec2 p){
  vec2 texel=1./vec2(textureSize(u_film,0));
  vec2 uv=.5+p*${paneScale}.*texel;
  float left=texture(u_film,uv-vec2(texel.x,0)).r;
  float right=texture(u_film,uv+vec2(texel.x,0)).r;
  float low=texture(u_film,uv-vec2(0,texel.y)).r;
  float high=texture(u_film,uv+vec2(0,texel.y)).r;
  return vec3(4.*vec2(left-right,low-high),texture(u_film,uv).r);
}
`;
