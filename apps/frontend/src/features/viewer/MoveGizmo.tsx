import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

export type MoveAxis = "x" | "y" | "z";
export type MoveDelta = { x: number; y: number; z: number };

type Props = {
  center: THREE.Vector3 | null;
  selectedAxis?: MoveAxis | null;
  onPreviewDelta: (delta: MoveDelta) => void;
  onCommitDelta: (delta: MoveDelta) => void;
  onCancelDelta: () => void;
};

const axisVectors: Record<MoveAxis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

const axisColors: Record<MoveAxis, string> = {
  x: "#e46b6b",
  y: "#70d486",
  z: "#6c9bea",
};

function emptyDelta(): MoveDelta {
  return { x: 0, y: 0, z: 0 };
}

function MoveGizmo({
  center,
  selectedAxis,
  onPreviewDelta,
  onCommitDelta,
  onCancelDelta,
}: Props) {
  const { camera, gl } = useThree();
  const [activeAxis, setActiveAxis] = useState<MoveAxis | null>(selectedAxis ?? null);
  const [numericValue, setNumericValue] = useState("");
  const visibleAxes = selectedAxis ? [selectedAxis] : (["x", "y", "z"] as MoveAxis[]);

  useEffect(() => {
    if (!selectedAxis) {
      setActiveAxis(null);
      return;
    }
    setActiveAxis(selectedAxis);
    setNumericValue("");
  }, [selectedAxis]);
  const dragRef = useRef<{
    axis: MoveAxis;
    startParameter: number;
    delta: MoveDelta;
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (activeAxis || numericValue !== "") {
        onCancelDelta();
        setActiveAxis(null);
        setNumericValue("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeAxis, numericValue, onCancelDelta]);

  useEffect(() => {
    if (!activeAxis) return;

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !center) return;

      const rect = gl.domElement.getBoundingClientRect();

      const normalized = new THREE.Vector2(
        (event.clientX / rect.width) * 2 - 1,
        -(event.clientY / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(normalized, camera);
      const axis = axisVectors[drag.axis];
      const rayOrigin = raycaster.ray.origin;
      const rayDirection = raycaster.ray.direction;
      const offset = rayOrigin.clone().sub(center);
      const cross = rayDirection.clone().cross(axis);
      const denominator = cross.lengthSq();
      if (denominator < 1e-8) return;

      const parameter = offset.clone().cross(rayDirection).dot(cross) / denominator;
      const deltaValue = parameter - drag.startParameter;
      const delta = emptyDelta();
      delta[drag.axis] = deltaValue;
      drag.delta = delta;
      onPreviewDelta(delta);
    };

    const handlePointerUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      setActiveAxis(null);
      if (drag) onCommitDelta(drag.delta);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeAxis, camera, center, gl, onCommitDelta, onPreviewDelta]);

  if (!center) return null;

  const startDrag = (axis: MoveAxis, event: { stopPropagation: () => void; ray: THREE.Ray }) => {
    event.stopPropagation();
    const axisVector = axisVectors[axis];
    const rayOrigin = event.ray.origin;
    const rayDirection = event.ray.direction;
    const offset = rayOrigin.clone().sub(center);
    const cross = rayDirection.clone().cross(axisVector);
    const denominator = cross.lengthSq();
    const startParameter = denominator < 1e-8
      ? 0
      : offset.clone().cross(rayDirection).dot(cross) / denominator;

    dragRef.current = { axis, startParameter, delta: emptyDelta() };
    setActiveAxis(axis);
    setNumericValue("");
  };

  const selectAxis = (axis: MoveAxis, event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    setActiveAxis(axis);
    setNumericValue("");
  };

  const applyNumeric = () => {
    const value = numericValue.trim() === "" ? NaN : Number(numericValue);
    if (!Number.isFinite(value) || !activeAxis) return;
    const delta = emptyDelta();
    delta[activeAxis] = value;
    onPreviewDelta(delta);
    onCommitDelta(delta);
    setActiveAxis(null);
    setNumericValue("");
  };

  const cancelNumeric = () => {
    onCancelDelta();
    setActiveAxis(null);
    setNumericValue("");
  };

  return (
    <group position={center}>
      {visibleAxes.map((axis) => {
        const direction = axisVectors[axis];
        const length = selectedAxis ? 120 : 90;
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction
        );
        const color = axisColors[axis];
        const isActive = activeAxis === axis;

        return (
          <group key={axis}>
            <mesh
              position={direction.clone().multiplyScalar(length / 2)}
              quaternion={quaternion}
              onPointerDown={(event) => startDrag(axis, event)}
              onClick={(event) => selectAxis(axis, event)}
            >
              <cylinderGeometry args={[isActive ? 4 : 2.5, isActive ? 4 : 2.5, length, 8]} />
              <meshBasicMaterial color={color} depthTest={false} />
            </mesh>
            <mesh
              position={direction.clone().multiplyScalar(length)}
              quaternion={quaternion}
              onPointerDown={(event) => startDrag(axis, event)}
              onClick={(event) => selectAxis(axis, event)}
            >
              <coneGeometry args={[isActive ? 8 : 6, 18, 8]} />
              <meshBasicMaterial color={color} depthTest={false} />
            </mesh>
            <Html position={direction.clone().multiplyScalar(length + 16)} center>
              <button
                type="button"
                title={`Move ${axis.toUpperCase()}`}
                onClick={(event) => selectAxis(axis, event)}
                style={{
                  border: 0,
                  background: "transparent",
                  color,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "12px",
                  padding: "2px",
                }}
              >
                {axis.toUpperCase()}
              </button>
            </Html>
            {isActive && (
              <Html position={direction.clone().multiplyScalar(length + 28)} center>
                <input
                  autoFocus={selectedAxis === axis || isActive}
                  type="text"
                  inputMode="decimal"
                  value={numericValue}
                  placeholder="mm"
                  aria-label={`Move ${axis.toUpperCase()}`}
                  onChange={(event) => setNumericValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyNumeric();
                    if (event.key === "Escape") cancelNumeric();
                  }}
                  style={{ width: "72px", padding: "4px", fontSize: "11px", textAlign: "center" }}
                />
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

export default MoveGizmo;
