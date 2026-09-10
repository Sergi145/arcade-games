"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import {
  createBloqueBusterEngine,
  type BloqueBusterEngineHandle,
} from "@/lib/bloque-buster-engine";
import type { RealGameProps } from "@/components/rocas-canvas";

export default function BloqueBusterCanvas({ onUpdate, ref }: RealGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BloqueBusterEngineHandle | null>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createBloqueBusterEngine(canvas, {
      onUpdate: (state) => onUpdateRef.current(state),
    });
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      pause: () => engineRef.current?.pause(),
      resume: () => engineRef.current?.resume(),
      reset: () => engineRef.current?.reset(),
      forceGameOver: () => engineRef.current?.forceGameOver(),
    }),
    [],
  );

  return <canvas ref={canvasRef} />;
}
