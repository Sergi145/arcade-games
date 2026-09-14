"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import {
  createSerpentinaEngine,
  type SerpentinaEngineHandle,
} from "@/lib/serpentina-engine";
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
  /** Skin visual seleccionada; se resuelve una vez al montar el motor. */
  skin?: SkinId;
};

export default function SerpentinaCanvas({
  onUpdate,
  ref,
  skin,
}: RealGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SerpentinaEngineHandle | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const initialSkinRef = useRef(skin);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createSerpentinaEngine(canvas, {
      onUpdate: (state) => onUpdateRef.current(state),
      skin: initialSkinRef.current,
    });
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Aplica el cambio de skin al motor ya en marcha (no lo recrea): un
  // cambio de skin no debe reiniciar la partida ni tocar el estado de
  // pausa.
  useEffect(() => {
    engineRef.current?.setSkin(skin ?? "clasico");
  }, [skin]);

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
