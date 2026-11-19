"use client";
import { useEffect, useRef, useState, type RefObject } from 'react';
import { scenes, type SceneId } from './scenes';
import { mountRoom, type WeatherCondition } from './weather';

export type SilhouetteShaderProps = { scene:SceneId; instant:Date; latitude:number; longitude:number; facing?:number; overcast?:boolean; paused?:boolean; weather?:WeatherCondition; preview?:RefObject<HTMLCanvasElement|null> };
export function SilhouetteShader(props:SilhouetteShaderProps){
  const canvas=useRef<HTMLCanvasElement>(null),room=useRef<ReturnType<typeof mountRoom>|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!canvas.current)return;
    const state={...props,animated:!props.paused,preview:props.preview?.current,onError:setError};
    try{if(room.current)room.current.update(props.weather??'clear',state);else room.current=mountRoom(canvas.current,props.weather??'clear',state);}catch(e){setError(e instanceof Error?e.message:'Could not start light study');}
  },[props]);
  useEffect(()=>()=>{room.current?.dispose();room.current=null;},[]);
  return <><canvas ref={canvas} className="light-canvas" role="img" aria-label={`${scenes.find(s=>s.id===props.scene)?.name} light study`}/>{error&&<p className="graphics-error" role="alert">{error}</p>}</>;
}
