"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import { createRocasEngine, type RocasEngineHandle } from "@/lib/rocas-engine";
import type { RealGameState } from "@/components/real-game-registry";
import type { SkinId } from "@/lib/skins";

export type RealGameHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
};

export type RealGameProps = {
  onUpdate: (state: RealGameState) => void;
  ref?: React.Ref<RealGameHandle>;
  /** Skin visual seleccionada; los juegos que aún no la soportan la ignoran. */
  skin?: SkinId;
};

export default function RocasCanvas({ onUpdate, ref }: RealGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RocasEngineHandle | null>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createRocasEngine(canvas, {
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
