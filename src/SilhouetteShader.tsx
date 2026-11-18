"use client";

import { useEffect, useRef, useState } from "react";
import { createFullscreenFragment } from "@tschk/moonshine-next/shaders";
import { silhouetteFragment } from "./shader";
import { scenes, type SceneId } from "./scenes";
import { solarPosition } from "./solar";

export type SilhouetteShaderProps = {
  scene: SceneId;
  instant: Date;
  latitude: number;
  longitude: number;
  facing?: number;
  overcast?: boolean;
  paused?: boolean;
};

/** A self-contained Moonshine/Next-compatible canvas. Coordinates stay on the device. */
export function SilhouetteShader(props: SilhouetteShaderProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(props);
  current.current = props;
  const [error, setError] = useState("");

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const gl = element.getContext("webgl2", { alpha: false, antialias: false, depth: false });
    if (!gl) {
      setError("This light study needs WebGL 2. Try a browser with hardware acceleration enabled.");
      return;
    }
    const sources = createFullscreenFragment(silhouetteFragment);
    const program = gl.createProgram();
    if (!program) { setError("The light study could not start. Reload to try again."); return; }
    const shaders: WebGLShader[] = [];
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, sources.vertex], [gl.FRAGMENT_SHADER, sources.fragment]] as const) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Could not allocate a shader");
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compilation failed");
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Shader linking failed");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the light study");
      for (const shader of shaders) gl.deleteShader(shader);
      gl.deleteProgram(program);
      return;
    }
    for (const shader of shaders) gl.deleteShader(shader);
    gl.useProgram(program);
    const uniform = Object.fromEntries(["resolution", "time", "scene", "elevation", "azimuth", "facing", "overcast"].map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let elapsed = 0;
    let previous = performance.now();
    let lastDraw = 0;
    let lost = false;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const state = current.current;
      const delta = Math.min((now - previous) / 1000, .1);
      previous = now;
      if (document.hidden || lost) return;
      if (!state.paused && !reduce.matches) elapsed += delta;
      if (now - lastDraw < 32) return;
      lastDraw = now;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(element.clientWidth * dpr));
      const height = Math.max(1, Math.round(element.clientHeight * dpr));
      if (element.width !== width || element.height !== height) { element.width = width; element.height = height; }
      gl.viewport(0, 0, width, height);
      const sun = solarPosition(state.instant, state.latitude, state.longitude);
      gl.uniform2f(uniform.resolution, width, height);
      gl.uniform1f(uniform.time, elapsed);
      gl.uniform1f(uniform.scene, scenes.findIndex(scene => scene.id === state.scene));
      gl.uniform1f(uniform.elevation, sun.elevation * Math.PI / 180);
      gl.uniform1f(uniform.azimuth, sun.azimuth * Math.PI / 180);
      gl.uniform1f(uniform.facing, (state.facing ?? 135) * Math.PI / 180);
      gl.uniform1f(uniform.overcast, state.overcast ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      element.dataset.ready = "true";
    };
    const contextLost = (event: Event) => {
      event.preventDefault(); lost = true; element.dataset.ready = "false";
      setError("The graphics connection was interrupted. Reload to restore the light study.");
    };
    element.addEventListener("webglcontextlost", contextLost);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("webglcontextlost", contextLost);
      gl.deleteProgram(program);
    };
  }, []);

  return <>
    <canvas ref={canvas} className="light-canvas" role="img" aria-label={`${scenes.find(scene => scene.id === props.scene)?.name} light study`} />
    {error && <p className="graphics-error" role="alert">{error}</p>}
  </>;
}
