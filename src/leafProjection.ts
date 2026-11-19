// Tessellated leaf surfaces in receiver coordinates. z is distance from the wall;
// the vertex pass projects each moving point onto it along the incoming ray.
export function leafProjection(gl: WebGL2RenderingContext) {
  const vertices:number[]=[];
  type Point=readonly [number,number,number,number,number,number];
  function sheet(n:number,m:number,point:(u:number,v:number)=>Point,open:(u:number,v:number)=>boolean){
    for(let i=0;i<n;i++)for(let j=0;j<m;j++){
      const u=i/n,v=j/m*2-1;
      if(open(u+.5/n,v+1/m))continue;
      const a=point(u,v),b=point(u+1/n,v),c=point(u+1/n,v+2/m),d=point(u,v+2/m);
      vertices.push(...a,...b,...d,...b,...c,...d);
    }
  }
  const leaves=[
    {x:162,y:107,z:13,l:43,w:14,angle:-.34,fold:7,phase:1.5,age:3},
    {x:153,y:84,z:17,l:35,w:9,angle:-.32,fold:-8,phase:4.2,age:3},
    {x:141,y:128,z:23,l:21,w:7,angle:-2.63,fold:4,phase:2.1,age:1},
    {x:142,y:140,z:34,l:32,w:11,angle:-2.27,fold:6,phase:.2,age:2},
    {x:141,y:150,z:21,l:20,w:7,angle:-.70,fold:5,phase:3.1,age:0},
  ];
  for(const {x,y,z,l,w,angle,fold,phase,age} of leaves){
    const ca=Math.cos(angle),sa=Math.sin(angle);
    sheet(28,1,(u,v)=>{
      const bow=Math.sin(u*Math.PI),r=.49+.30*(1-u);
      return [130+(x-130)*u+(8*Math.sin(phase))*bow+v*r,176+(y-176)*u+3*bow,z*u,u*.35,phase,z];
    },()=>false);
    sheet(74,44,(u,v)=>{
      const flank=v<0?-1:1;let margin=Math.pow(Math.max(0,Math.sin(Math.PI*u**.70)),.73)*(1+.16*flank*Math.sin(3.4*u+phase));
      for(let j=0;j<age;j++){
        const cut=.24+.201*j+.065*Math.sin(phase+2*j+flank);
        margin*=1-(.59+.13*Math.sin(phase+j+flank))*Math.exp(-Math.pow((u-cut)/(.033+.009*Math.sin(j+phase)),2));
      }
      const rib=l*u+(15*u-8)*Math.abs(v)*margin+6*v*v*Math.sin(4*u+phase), span=v*w*margin;
      return [x+ca*rib-sa*span,y+sa*rib+ca*span+2.3*Math.sin(u*3.6),z+fold*(.75*Math.sin(Math.PI*u)+v*v*.65-.48*u*v),.35+.65*u+.23*Math.abs(v),phase,z];
    },(u,v)=>{
      for(let j=0;j<age-1;j++){
        const side=j%2?1:-1;
        if(((u-.25-j*.19-.22*(v-side*.49))/.060)**2+((v-side*.49)/.24)**2<1)return true;
      }return false;
    });
  }
  const program=gl.createProgram()!,buf=gl.createBuffer()!,vao=gl.createVertexArray()!,fb=gl.createFramebuffer()!;
  for(const [kind,source] of [[gl.VERTEX_SHADER,`#version 300 es
layout(location=0) in vec3 position;layout(location=1) in vec3 joint;
uniform vec3 lightTime;out float depth;
void main(){float u=joint.x,phase=joint.y,t=lightTime.z;
float gust=sin(t*.83+phase)+.38*sin(t*1.37+phase*.7)+.24*sin(t*.38-phase);
float bend=u*u*gust; vec3 v=position+vec3(2.8*bend,2.*bend+u*sin(t*1.16+phase),1.9*bend);
vec2 xy=v.xy+(v.z-joint.z)*vec2(.41,-.22)+v.z*lightTime.xy;
gl_Position=vec4(xy/vec2(294.,165.)*2.-1.,0.,1.);depth=joint.z;}`],[gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;in float depth;out vec4 color;void main(){color=depth<20.?vec4(1,0,0,1):vec4(0,1,0,1);}`]] as const){
    const sh=gl.createShader(kind)!;gl.shaderSource(sh,source);gl.compileShader(sh);gl.attachShader(program,sh);gl.deleteShader(sh);
  }
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)??'Leaf projection failed');
  const time=gl.getUniformLocation(program,'lightTime');gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  for(const i of [0,1]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,24,12*i);}gl.bindVertexArray(null);
  return {draw(texture:WebGLTexture,t:number,bearing:number,alt:number){
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.viewport(0,0,882,495);
    gl.useProgram(program);gl.bindVertexArray(vao);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendEquation(gl.MAX);
    gl.uniform3f(time,.52*(bearing-.288),.65*(Math.sin(alt)-.89),t);gl.drawArrays(gl.TRIANGLES,0,vertices.length/6);
    gl.disable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.bindVertexArray(null);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,texture);gl.generateMipmap(gl.TEXTURE_2D);
  },dispose(){gl.deleteProgram(program);gl.deleteBuffer(buf);gl.deleteVertexArray(vao);gl.deleteFramebuffer(fb);}};
}
