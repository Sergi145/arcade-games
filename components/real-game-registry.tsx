import type { ComponentType } from "react";
import RocasCanvas, { type RealGameProps } from "./rocas-canvas";

export type { RealGameProps, RealGameHandle } from "./rocas-canvas";

export const REAL_GAMES: Record<string, ComponentType<RealGameProps>> = {
  rocas: RocasCanvas,
};
