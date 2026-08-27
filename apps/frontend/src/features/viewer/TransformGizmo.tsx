import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import MoveGizmo, { MoveDelta } from "./MoveGizmo";
export type { MoveDelta } from "./MoveGizmo";

export type TransformMode = "move" | "rotate" | "scale";
export type RotationDelta = MoveDelta;
export type ScaleFactors = MoveDelta;

type Props = {
  mode: TransformMode | null;
  center: THREE.Vector3 | null;
  selectedAxis?: "x" | "y" | "z" | null;
  onMovePreview: (delta: MoveDelta) => void;
  onMoveCommit: (delta: MoveDelta) => void | Promise<void>;
  onRotatePreview: (delta: RotationDelta) => void;
  onRotateCommit: (delta: RotationDelta) => void | Promise<void>;
  onScalePreview: (factors: ScaleFactors) => void;
  onScaleCommit: (factors: ScaleFactors) => void | Promise<void>;
};

const axes = ["x", "y", "z"] as const;
type Axis = (typeof axes)[number];
const colors: Record<Axis, string> = {
  x: "#e46b6b",
  y: "#70d486",
  z: "#6c9bea",
};

function TransformGizmo(props: Props) {
  if (!props.mode || !props.center) return null;
  if (props.mode === "move") {
    return (
      <MoveGizmo
        center={props.center}
        selectedAxis={props.selectedAxis}
        onPreviewDelta={props.onMovePreview}
        onCommitDelta={props.onMoveCommit}
        onCancelDelta={() => props.onMovePreview({ x: 0, y: 0, z: 0 })}
      />
    );
  }

  return <TransformHandles {...props} />;
}

function TransformHandles({
  mode,
  center,
  onRotatePreview,
  onRotateCommit,
  onScalePreview,
  onScaleCommit,
}: Props) {
  const [activeAxis, setActiveAxis] = useState<Axis | null>(null);
  const [value, setValue] = useState("");
  const drag = useRef<{ axis: Axis; lastX: number; value: number } | null>(null);

  useEffect(() => {
    if (!activeAxis || !drag.current) return;

    const onMove = (event: PointerEvent) => {
      if (!drag.current) return;
      const factor = mode === "rotate" ? 0.5 : 0.01;
      const increment = (event.clientX - drag.current.lastX) * factor;
      drag.current.lastX = event.clientX;
      drag.current.value += increment;

      if (mode === "rotate") {
        const delta = { x: 0, y: 0, z: 0 };
        delta[drag.current.axis] = drag.current.value;
        onRotatePreview(delta);
      } else {
        const factors = { x: 1, y: 1, z: 1 };
        factors[drag.current.axis] = Math.max(0.01, 1 + drag.current.value);
        onScalePreview(factors);
      }
    };

    const onUp = () => {
      const current = drag.current;
      drag.current = null;
      setActiveAxis(null);
      if (!current) return;

      if (mode === "rotate") {
        const delta = { x: 0, y: 0, z: 0 };
        delta[current.axis] = current.value;
        void onRotateCommit(delta);
      } else {
        const factors = { x: 1, y: 1, z: 1 };
        factors[current.axis] = Math.max(0.01, 1 + current.value);
        void onScaleCommit(factors);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      drag.current = null;
      setActiveAxis(null);
      setValue("");
      if (mode === "rotate") onRotatePreview({ x: 0, y: 0, z: 0 });
      else onScalePreview({ x: 1, y: 1, z: 1 });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeAxis, mode, onRotateCommit, onRotatePreview, onScaleCommit, onScalePreview]);

  const start = (axis: Axis, event: { stopPropagation: () => void; nativeEvent: { clientX: number } }) => {
    event.stopPropagation();
    drag.current = { axis, lastX: event.nativeEvent.clientX, value: 0 };
    setActiveAxis(axis);
    setValue("");
  };

  const applyNumeric = () => {
    if (!activeAxis) return;
    const parsed = Number(value.trim());
    if (!Number.isFinite(parsed)) return;

    if (mode === "rotate") {
      const delta = { x: 0, y: 0, z: 0 };
      delta[activeAxis] = parsed;
      void onRotateCommit(delta);
    } else if (parsed > 0) {
      const factors = { x: 1, y: 1, z: 1 };
      factors[activeAxis] = parsed;
      void onScaleCommit(factors);
    }

    setActiveAxis(null);
    setValue("");
  };

  return (
    <group position={center ?? undefined}>
      {axes.map((axis) => {
        const color = colors[axis];
        const active = activeAxis === axis;
        const offset = axis === "x" ? [85, 0, 0] : axis === "y" ? [0, 85, 0] : [0, 0, 85];
        const ringRotation = axis === "x" ? [0, Math.PI / 2, 0] : axis === "y" ? [Math.PI / 2, 0, 0] : [0, 0, 0];

        return (
          <group key={axis}>
            {mode === "rotate" ? (
              <mesh
                rotation={ringRotation as [number, number, number]}
                onPointerDown={(event) => start(axis, event)}
                onClick={(event) => start(axis, event)}
              >
                <torusGeometry args={[70, active ? 5 : 3, 10, 48]} />
                <meshBasicMaterial color={color} depthTest={false} />
              </mesh>
            ) : (
              <mesh
                position={offset as [number, number, number]}
                onPointerDown={(event) => start(axis, event)}
                onClick={(event) => start(axis, event)}
              >
                <boxGeometry args={[active ? 14 : 10, active ? 14 : 10, active ? 14 : 10]} />
                <meshBasicMaterial color={color} depthTest={false} />
              </mesh>
            )}
            <Html position={offset as [number, number, number]} center>
              <button
                type="button"
                title={`${mode} ${axis.toUpperCase()}`}
                onClick={(event) => start(axis, event)}
                style={{ border: 0, background: "transparent", color, fontWeight: 700, cursor: "pointer" }}
              >
                {axis.toUpperCase()}
              </button>
            </Html>
            {active && (
              <Html position={[0, 120, 0]} center>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    background: "rgba(15, 17, 21, 0.9)",
                    border: "1px solid rgba(115, 133, 154, 0.6)",
                    boxShadow: "0 8px 22px rgba(0,0,0,0.2)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "9px",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: color,
                      fontWeight: 700,
                    }}
                  >
                    {mode === "rotate" ? "Angle" : "Factor"}
                  </span>
                  <input
                    autoFocus
                    value={value}
                    placeholder={mode === "rotate" ? "30°" : "1.25"}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applyNumeric();
                      if (event.key === "Escape") {
                        setActiveAxis(null);
                        setValue("");
                      }
                    }}
                    style={{
                      width: "86px",
                      padding: "4px 6px",
                      fontSize: "11px",
                      textAlign: "center",
                      background: "rgba(10, 13, 17, 0.94)",
                      color: "#eff5ff",
                      border: `1px solid ${color}`,
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

export default TransformGizmo;
