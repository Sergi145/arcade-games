import type { ComponentType } from "react";
import RocasCanvas, { type RealGameProps } from "./rocas-canvas";
import CaidaCanvas from "./caida-canvas";
import BloqueBusterCanvas from "./bloque-buster-canvas";

export type { RealGameProps, RealGameHandle } from "./rocas-canvas";

export type RealGameState = {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
};

export const REAL_GAMES: Record<string, ComponentType<RealGameProps>> = {
  rocas: RocasCanvas,
  caida: CaidaCanvas,
  "bloque-buster": BloqueBusterCanvas,
};
