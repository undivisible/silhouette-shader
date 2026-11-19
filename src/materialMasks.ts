import type { SceneId } from './scenes';

// Original wall-space drawings. Red encodes the material's silhouette or
// reflection; blue encodes the shadow beneath the reflector.
export function materialMask(scene: SceneId) {
  if (!['bough','slats','canopy','foil','trellis','washi','oculus','clerestory','vault'].includes(scene)) return null;
  const canvas=document.createElement('canvas'); canvas.width=882;canvas.height=495;
  const c=canvas.getContext('2d')!;c.scale(3,3);c.fillStyle='black';c.fillRect(0,0,294,165);
  function fill(path:string,color:string,blur=0){c.filter=blur?`blur(${3*blur}px)`:'none';c.fillStyle=color;c.fill(new Path2D(path));}
  function line(path:string,color:string,width:number,blur=0){c.filter=blur?`blur(${3*blur}px)`:'none';c.lineWidth=width;c.lineCap='round';c.strokeStyle=color;c.stroke(new Path2D(path));}
  // Green carries a second optical plane, projected separately as the sun moves.
  c.globalCompositeOperation='lighter';
  if(scene==='vault'){
    line('M-8 82 Q78 63 212 43','#c70000',2.2,.5);
    for(let i=0;i<27;i++){
      const x=i*6.2,y=79-i*1.22,reach=15+27*Math.sin(i/27*Math.PI),v=i%3===0?1:-1;
      fill(`M${x} ${y} q${reach*.46} ${v*8-4} ${reach} ${v*(11+7*Math.sin(i*2))} q${-reach*.48} ${-v*7+2} ${-reach} ${-v*(11+7*Math.sin(i*2))}`,i%4===0?'#00b900':'#ed0000');
    }
  }else if(scene==='oculus'){
    for(const [x,y,tilt,colour] of [[-46,111,-.10,'#009f00'],[-16,88,.07,'#eb0000']] as const){
      c.save();c.translate(x,y);c.rotate(tilt);
      line('M0 0 Q101 -24 325 46',colour,2,.7);
      for(let i=0;i<12;i++){
        const u=i/12, a=12+i*25+2*Math.sin(i*2.1), b=-20*u+69*u*u;
        for(const side of [-1,1]){
          const l=(44+57*Math.sin(Math.PI*(u*.79+.11)))*(1+.16*Math.sin(i*1.7+side));
          const dx=l*(side>0?.49:1.05), dy=l*(side>0?.83:-.20), w=5.8+1.4*Math.sin(i);
          fill(`M${a} ${b} q${dx*.54+w} ${dy*.23-w} ${dx} ${dy} q${-dx*.45} ${-dy*.64-w} ${-dx} ${-dy}`,colour);
        }
      }c.restore();
    }
  }else if(scene==='clerestory'){
    for(const [x,y,angle,size,colour] of [[170,-68,.26,1.10,'#00c100'],[150,-58,.23,1.16,'#d40000'],[140,-48,-.16,1.09,'#c00000']] as const){
      c.save();c.translate(x,y);c.rotate(angle);c.scale(size,size);
      line('M0 0 Q10 96 -4 210',colour,1.8,1.6);
      for(let i=0;i<21;i++)for(const side of [-1,1]){
        const u=i/21,y0=i*9.8+side*1.8,x0=11*u-15*u*u,w=(6+24*Math.sin(Math.PI*u))*(1+.12*Math.sin(i*2+side)),h=15+8*Math.cos(u*2);
        fill(`M${x0} ${y0} q${side*w*.64} ${-h*.48} ${side*w} ${h} q${-side*w*.52} ${-h*.50} ${-side*w} ${-h+4}`,colour);
      }c.restore();
    }
  }else if(scene==='bough'){
    line('M92 94 Q111 96 137 79 M106 92 Q116 87 123 77 M113 90 Q126 95 140 90','#bf0000',.75,.8);
    for(const [x,y,r,a] of [[104,94,6,-.4],[111,91,6,.6],[115,87,8,-.4],[120,83,7,.6],[127,81,9,.15],[132,82,6,1],[126,91,7,.75],[135,89,7,-.4]]){
      c.save();c.translate(x!,y!);c.rotate(a!);c.scale(r!/7,r!/7);fill('M-6 1 Q0 -5 8 -1 Q2 4 -6 1',a!>0?'#00cf00':'#ef0000',.35);c.restore();}
    line('M87 98 Q103 96 114 82 M92 96 L86 91 M100 94 L96 87 M106 90 L104 82','#00a900',1,.4);
  }else if(scene==='slats'){
    line('M130 174 Q141 151 158 114 Q165 98 174 90 M139 165 Q153 122 152 83 Q152 76 163 69 M143 155 Q140 143 133 130','#c90000',1.3,.65);
    // One split blade. The notches cut into its margin, not across its midrib.
    const blade='M0 0 C-5 -3 -3 -12 4 -17 Q8 -19 13 -19 Q6 -14 5 -9 Q14 -19 23 -19 Q17 -13 17 -10 Q26 -18 32 -16 Q27 -13 25 -9 Q34 -14 40 -11 Q44 -9 48 -5 Q41 -2 34 -3 Q30 -1 28 1 Q37 0 39 2 Q31 8 23 7 L26 3 Q17 5 13 11 Q7 15 1 12 Q-3 9 0 0Z M8 -5 C9 -8 12 -10 15 -10 Q12 -6 8 -5Z M19 -6 Q22 -10 25 -10 Q23 -7 19 -6Z M7 4 Q11 0 15 0 Q13 3 7 4Z';
    for(const [x,y,k,a] of [[166,108,1,-.28],[151,76,.83,-.43],[131,137,.64,-.15],[144,151,.51,-.18]]){
      c.save();c.translate(x!,y!);c.rotate(a!);c.scale(k!,k!);fill(blade,k!>.85?'#ff0000':'#00fa00',.22);c.globalCompositeOperation='destination-out';line('M2 1 Q14 -4 34 -7 M12 -3 L18 -13 M16 -4 L24 3 M22 -5 L31 -14','#fff',2.3,.16);c.restore();}
  }else if(scene==='foil'){
    const ridges=[
      'M20 95 Q37 92 47 96 T72 99 M46 96 Q52 90 65 89',
      'M31 79 Q55 76 77 77 Q93 79 105 77 M74 77 Q84 73 89 66',
      'M74 60 Q94 65 112 63 Q129 59 143 65 Q153 69 162 67',
      'M94 46 Q113 44 125 47 T156 51 Q178 51 194 56 M124 47 Q132 44 139 36',
      'M126 32 Q147 32 161 36 Q170 39 188 38 M160 36 Q151 41 148 47',
      'M142 64 Q153 70 171 72 Q184 73 196 69 Q211 67 241 70 M172 72 Q167 76 165 83',
      'M85 80 Q104 77 124 80 Q139 83 147 81 M124 80 Q132 74 141 73',
      'M196 49 Q208 48 224 50 M195 69 Q206 72 230 71'];
    for(const path of ridges){line(path,'#006900',9.2,3.2);line(path,'#390000',1.55,.85);}c.globalCompositeOperation='source-over';
    fill('M91 194 Q132 128 193 119 Q253 115 312 161 L312 194Z','#0000ac',4);
  }else if(scene==='washi'){
    c.transform(1,.405,0,1,0,-16);
    for(const [x,w,h] of [[41,2,136],[56,3,141],[83,4,134],[94,2,142],[100,5,137],[109,2.4,140],[133,4,142],[146,3,138]]) fill(`M${x} -24 h${w} v${h!+36} h-${w}Z`,'#720000',1.1);
    for(const y of [-1,19,43,66,91,114]){line(`M40 ${y} L93 ${y} M103 ${y+2} L147 ${y+2}`,'#6b0000',3.6,1.05);line(`M110 ${y+8} L132 ${y+8}`,'#390000',2.3,1.2);}
    c.setTransform(3.25,0,0,3.25,-14,-49);fill('M49 140 Q46 135 49 129 Q51 125 54 123 L53 120 L59 121 L57 124 Q65 130 63 137 Q62 142 59 144Z','#00ff00',.55);
  }else if(scene==='trellis'){
    const hole='M-8 -9 Q-3 -10 2 -4 Q5 -3 6 2 Q9 6 8 9 Q4 10 0 6 Q-4 5 -5 1 Q-9 -4 -8 -9Z';
    for(let j=-4;j<9;j++)for(let i=0;i<8;i++){const x=30+19*i+4*Math.sin(j*.63+i*1.8),y=j*28+i*14.8;const edge=y-(x-26)*.91;if(edge< -44||edge>138||x>181)continue;
      c.save();c.translate(x,y);c.rotate(.24*Math.sin(i*1.7+j));const scale=1.29+.23*Math.sin(j*2.1+i*2.8);c.scale(scale*1.18,scale);fill(hole,i<3?'#ee0000':'#00ed00',.5+i*.27);c.restore();}
  }else{
    // Large defocused apertures and small sharp glints occupy independent positions.
    const patches=[[0,17,15],[19,28,7],[51,16,13],[64,48,19],[54,58,11],[77,62,18],[87,76,12],[119,77,20],[146,83,22],[106,36,14],[118,28,12],[135,43,15],[163,21,20],[184,30,17],[202,40,12],[231,32,16],[258,47,19],[281,79,24],[136,110,23],[104,96,24],[63,100,13],[46,111,14],[24,123,9],[8,145,12],[75,152,15],[103,157,16],[173,144,16],[191,128,20],[216,143,18],[231,158,17],[254,126,13],[279,142,23]];
    const glints=[[8,55],[12,77],[4,39],[36,86],[38,99],[54,119],[70,104],[81,100],[91,86],[92,66],[84,56],[106,58],[121,45],[72,4],[133,3],[145,15],[162,47],[179,60],[206,47],[231,111],[248,114],[260,129],[182,150],[149,163],[93,143],[88,133],[22,133],[9,128]];
    for(const [i,[x,y,r]] of [...patches,...glints.map(([x,y],j)=>[x,y,3+(j*7%5)])].entries()){
      c.filter=`blur(${3*(r!>15?2.7:r!>8?1.45:.55)}px)`;c.fillStyle=`rgb(${210+(i*13)%42} 0 0)`;c.beginPath();c.ellipse(x!,y!,r!,r!*(.44+.12*Math.sin(i)),.43+.27*Math.sin(i*1.3),0,Math.PI*2);c.fill();}
    for(const [j,[x,y,r]] of patches.entries()){c.beginPath();c.filter='blur(5px)';c.fillStyle=j%3?'#009900':'#007700';c.ellipse(x!+13*Math.cos(j*4),y!+11,r!*.9,r!*.39,.54,0,Math.PI*2);c.fill();}
  }
  return canvas;
}
