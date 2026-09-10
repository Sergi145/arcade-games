"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import { createCaidaEngine, type CaidaEngineHandle } from "@/lib/caida-engine";
import type { RealGameProps } from "@/components/real-game-registry";

export default function CaidaCanvas({ onUpdate, ref }: RealGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CaidaEngineHandle | null>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createCaidaEngine(canvas, {
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
