"use client";

import { useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type TouchControlsLayout = {
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
  actions?: { code: string; label: string }[];
};

// Mismo patrón que REAL_GAMES/SKIN_ENABLED_GAMES en real-game-registry.tsx:
// specs futuros solo añaden aquí su propia entrada.
export const TOUCH_CONTROLS_LAYOUTS: Partial<
  Record<string, TouchControlsLayout>
> = {
  serpentina: { up: true, down: true, left: true, right: true },
};

function subscribeTouch(callback: () => void) {
  const mql = window.matchMedia("(pointer: coarse)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getTouchSnapshot() {
  return window.matchMedia("(pointer: coarse)").matches;
}

function getTouchServerSnapshot() {
  return false;
}

export function useIsTouchDevice(): boolean {
  return useSyncExternalStore(
    subscribeTouch,
    getTouchSnapshot,
    getTouchServerSnapshot,
  );
}

function dispatchKey(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code }));
}

function DirButton({
  code,
  label,
  className,
}: {
  code: string;
  label: string;
  className: string;
}) {
  const press = (e: ReactPointerEvent) => {
    e.preventDefault();
    dispatchKey("keydown", code);
  };
  const release = () => dispatchKey("keyup", code);

  return (
    <button
      type="button"
      aria-label={label}
      className={`touch-btn ${className}`}
      style={{ touchAction: "none" }}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
    >
      {label}
    </button>
  );
}

export function TouchControls({ layout }: { layout: TouchControlsLayout }) {
  return (
    <div className="touch-controls">
      <div className="touch-dpad">
        {layout.up && <DirButton code="ArrowUp" label="▲" className="up" />}
        {layout.left && (
          <DirButton code="ArrowLeft" label="◀" className="left" />
        )}
        {layout.right && (
          <DirButton code="ArrowRight" label="▶" className="right" />
        )}
        {layout.down && (
          <DirButton code="ArrowDown" label="▼" className="down" />
        )}
      </div>
      {layout.actions && layout.actions.length > 0 && (
        <div className="touch-actions">
          {layout.actions.map((action) => (
            <DirButton
              key={action.code}
              code={action.code}
              label={action.label}
              className="action"
            />
          ))}
        </div>
      )}
    </div>
  );
}
