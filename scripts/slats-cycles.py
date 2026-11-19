"""Original daylight transport study. Run: blender -b -P scripts/slats-cycles.py

Set STUDY_SAMPLES, STUDY_WIDTH, STUDY_TIMES (comma-separated seconds), and
STUDY_BOUNCES to render matched light paths without changing the geometry.
The camera sees only the plaster receiver. No image textures or mattes.
"""
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
s = bpy.context.scene
s.render.engine = 'CYCLES'
s.cycles.samples = int(os.getenv('STUDY_SAMPLES', '24'))
s.cycles.max_bounces = int(os.getenv('STUDY_BOUNCES', '5'))
s.cycles.use_denoising = False
w = int(os.getenv('STUDY_WIDTH', '640'))
s.render.resolution_x, s.render.resolution_y = w, round(w*9/16)
s.view_settings.exposure = .55
s.world = bpy.data.worlds.new('Sky fill')
s.world.color = (.36, .34, .32)

def material(name, rgb, roughness):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value = (*rgb,1); bs.inputs['Roughness'].default_value = roughness
    return m

plaster = material('Limewash', (.47,.40,.32), .91)
n = plaster.node_tree.nodes; links = plaster.node_tree.links
grain = n.new('ShaderNodeTexNoise'); grain.inputs['Scale'].default_value = 540; grain.inputs['Detail'].default_value = 2
bump = n.new('ShaderNodeBump'); bump.inputs['Distance'].default_value = .0008; bump.inputs['Strength'].default_value = .18
links.new(grain.outputs['Fac'],bump.inputs['Height']); links.new(bump.outputs['Normal'],n.get('Principled BSDF').inputs['Normal'])
wood = material('Painted basswood', (.71,.65,.53), .45)
green = material('Leaf cuticle', (.07,.14,.038), .46)
green.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value = .09
nt=green.node_tree; translucent=nt.nodes.new('ShaderNodeBsdfTranslucent');translucent.inputs['Color'].default_value=(.64,.73,.50,1)
mix=nt.nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=.28;nt.links.new(nt.nodes.get('Principled BSDF').outputs[0],mix.inputs[1]);nt.links.new(translucent.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],nt.nodes.get('Material Output').inputs['Surface'])

def box(name, center, size, mat, rot=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center); ob=bpy.context.object; ob.name=name; ob.dimensions=size
    ob.rotation_euler.z=rot; ob.data.materials.append(mat); return ob

box('Receiving wall', (0,0,-.06), (16,14,.12), plaster)
# An oblique window in an adjoining wall. The ray, not the camera or a UV
# transform, shears its rectangular opening onto the receiving plane.
angle=.39
def pos(x,y,z):return Vector((x*math.cos(angle)-y*math.sin(angle)-.26, x*math.sin(angle)+y*math.cos(angle)+3.25,z+2.35))
def jamb(name,x,y,z,dx,dy,dz):return box(name,pos(x,y,z),(dx,dy,dz),wood,angle)
for x in [-4.42,4.42]:jamb('Reveal',x,0,1.0,7,.17,9.0)
jamb('Header',0,0,4.18,2.1,.17,4.0);jamb('Sill',0,0,-1.49,2.1,.17,4.0)
for i in range(23):
    slat=jamb('Tilted blind',0,.014,.53+i*.074,1.85,.009,.005);slat.rotation_euler.x=-.20+.014*math.sin(i*.6)

def stem(points,r):
    curve=bpy.data.curves.new('Petiole','CURVE');curve.dimensions='3D';curve.bevel_depth=r;curve.bevel_resolution=2
    sp=curve.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for bp,p in zip(sp.bezier_points,points):bp.co=pos(*p);bp.handle_left_type=bp.handle_right_type='AUTO'
    ob=bpy.data.objects.new('Petiole',curve);s.collection.objects.link(ob);ob.data.materials.append(green)

leaves=[]
def leaf(root, length, width, lift, phase):
    # Closed, folded lamina with a longitudinal midrib, asymmetric clefts and
    # internal fenestrations. Depth varies along both axes of the leaf.
    verts=[];faces=[];nu,nv=64,32
    for i in range(nu+1):
        u=i/nu
        for j in range(nv+1):
            v=j/nv*2-1; lobe=math.sin(math.pi*u)**.68
            for c in [.26,.43,.62,.78]:lobe*=1-.7*math.exp(-((u-c-.14*abs(v)-.035*v)/.039)**2)*abs(v)**1.5
            verts.append(pos(length*u,.21*math.sin(u*2.7)+.12*v*v-.12*u*v, lift*u+.10*math.sin(u*3)+v*width*lobe)-pos(0,0,0))
    for i in range(nu):
        for j in range(nv):
            u=(i+.5)/nu;v=(j+.5)/nv*2-1
            if any(((u-c-.065*v)/.041)**2+((v-h)/.235)**2<1 for c,h in [( .22,-.40),(.32,.44),(.44,-.42),(.55,.43),(.65,-.38)]):continue
            a=i*(nv+1)+j;faces.append((a,a+nv+1,a+nv+2,a+1))
    mesh=bpy.data.meshes.new('Fenestrated lamina');mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new('Split leaf',mesh);s.collection.objects.link(ob);ob.location=pos(*root);ob.data.materials.append(green)
    for f in mesh.polygons:f.use_smooth=True
    thick=ob.modifiers.new('Lamina thickness','SOLIDIFY');thick.thickness=.0022
    leaves.append((ob,phase));stem([(-.78,-.28,.30),(-.61,-.30,root[2]*.80),root],.012)

leaf((-.36,-.26,1.24),.84,.235,-.15,.2);leaf((-.54,-.55,1.70),.68,.19,-.11,2.7);leaf((-.73,-.19,.82),.48,.21,.13,5.)
bpy.ops.object.camera_add(location=(.04,-.43,5));cam=bpy.context.object;cam.rotation_euler=(0,0,0);cam.data.type='ORTHO';cam.data.ortho_scale=4.95;s.camera=cam
# Keep the staging geometry in the light paths but outside the camera path.
for ob in s.objects:
    if ob.type in {'MESH','CURVE'} and ob.name!='Receiving wall':ob.visible_camera=False
bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.data.energy=10;sun.data.angle=math.radians(.535);sun.data.color=(1,.91,.79)
out=Path(os.getenv('STUDY_OUT','.amp/in/orb-backup/spatial'));out.mkdir(parents=True,exist_ok=True)
for frame,t in enumerate(map(float,os.getenv('STUDY_TIMES','0').split(','))):
    sun.rotation_euler=Vector((.23-.023*t,-1.04+.014*t,-1)).to_track_quat('-Z','Y').to_euler()
    for ob,phase in leaves:ob.rotation_euler.y=.028*math.sin(t*.72+phase)+.011*math.sin(t*1.33+phase)
    s.render.filepath=str(out/f'{frame:04}.png');bpy.ops.render.render(write_still=True)
