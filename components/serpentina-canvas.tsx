"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import {
  createSerpentinaEngine,
  type SerpentinaEngineHandle,
} from "@/lib/serpentina-engine";
import type { RealGameState } from "@/components/real-game-registry";

export type RealGameHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
};

export type RealGameProps = {
  onUpdate: (state: RealGameState) => void;
  ref?: React.Ref<RealGameHandle>;
};

export default function SerpentinaCanvas({ onUpdate, ref }: RealGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SerpentinaEngineHandle | null>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createSerpentinaEngine(canvas, {
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
