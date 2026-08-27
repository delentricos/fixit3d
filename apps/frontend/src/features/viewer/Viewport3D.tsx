import React from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  GizmoHelper,
  GizmoViewport,
  Html,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";

import { Part } from "../parts/types";
import { useSelectionStore } from "../../shared/state/selectionStore";
import PartMesh from "./components/PartMesh";
import SceneLighting from "./components/SceneLighting";
import GroundGrid from "./components/GroundGrid";
import TransformGizmo, { MoveDelta, RotationDelta, ScaleFactors } from "./TransformGizmo";
import type {
  MeasurementSummary,
  MeasurementResult,
} from "./measurement";
import {
  measureBetweenParts,
  measureWorldBoundingBox,
} from "./measurement";
import {
  orthonormalBasis,
  planeVisualSizeFromPart,
  type PlanePickReference,
  type ReferencePlane,
  type ReferencePlaneType,
} from "../cad/referencePlanes";

function MeasurementOverlay({
  measurement,
  box,
  betweenBoxes,
}: {
  measurement: MeasurementResult | null;
  box: THREE.Box3 | null;
  betweenBoxes: { boxA: THREE.Box3; boxB: THREE.Box3 } | null;
}) {
  const helper = React.useMemo(() => {
    const nextHelper = new THREE.Box3Helper(
      new THREE.Box3(),
      "#d8e6f5"
    );
    nextHelper.raycast = () => undefined;
    nextHelper.renderOrder = 10;
    return nextHelper;
  }, []);

  React.useEffect(() => {
    if (box) helper.box.copy(box);
    helper.visible = measurement?.target.kind === "bounding-box";
    helper.updateMatrixWorld(true);
  }, [box, helper, measurement]);

  React.useEffect(() => () => {
    helper.removeFromParent();
    helper.geometry.dispose();
    if (Array.isArray(helper.material)) {
      helper.material.forEach((material) => material.dispose());
    } else {
      helper.material.dispose();
    }
  }, [helper]);

  const lineGeometry = React.useMemo(() => {
    if (!betweenBoxes) return null;

    const start = betweenBoxes.boxA.getCenter(new THREE.Vector3());
    const end = betweenBoxes.boxB.getCenter(new THREE.Vector3());
    return new THREE.BufferGeometry().setFromPoints([start, end]);
  }, [betweenBoxes]);

  React.useEffect(() => () => lineGeometry?.dispose(), [lineGeometry]);

  const markerGeometry = React.useMemo(
    () => new THREE.SphereGeometry(5, 12, 8),
    []
  );

  React.useEffect(() => () => markerGeometry.dispose(), [markerGeometry]);

  const between = measurement?.target.kind === "between-parts";

  return (
    <>
      <primitive object={helper} />
      {between && lineGeometry && betweenBoxes && (
        <>
          <lineSegments geometry={lineGeometry} raycast={() => null}>
            <lineBasicMaterial color="#f0c674" linewidth={2} />
          </lineSegments>
          {[betweenBoxes.boxA, betweenBoxes.boxB].map((partBox, index) => {
            const center = partBox.getCenter(new THREE.Vector3());
            return (
              <mesh
                key={index}
                position={center}
                geometry={markerGeometry}
                raycast={() => null}
              >
                <meshBasicMaterial color="#f0c674" />
              </mesh>
            );
          })}
        </>
      )}
    </>
  );
}

type ContextualReference = {
  partId: string;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  axis: "x" | "y" | "z" | null;
  kind: "face" | "edge" | "vertex" | "axis";
};

type HoleDraft = {
  partId: string;
  origin: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  xAxis: { x: number; y: number; z: number };
  yAxis: { x: number; y: number; z: number };
  diameter: number;
  depth: number;
  throughAll: boolean;
  center: { x: number; y: number };
  referencePlaneId?: string;
};

type PlaneDraft = {
  partId: string;
  type: ReferencePlaneType;
  name: string;
  distance: number;
  angle: number;
  flip: boolean;
  sourcePlane?: ReferencePlane;
  sourcePlaneB?: ReferencePlane;
  pointA?: { x: number; y: number; z: number };
  pointB?: { x: number; y: number; z: number };
  pointC?: { x: number; y: number; z: number };
  throughPoint?: { x: number; y: number; z: number };
  lineStart?: { x: number; y: number; z: number };
  lineEnd?: { x: number; y: number; z: number };
  error?: string | null;
};

type Props = {
  parts: Part[];
  grid: string;
  measuredPartId: string | null;
  measuredPartIds: [string, string] | null;
  measurementRequest: number;
  onMeasurementChange: (measurement: MeasurementResult | null) => void;
  onMoveDelta: (delta: MoveDelta) => void | Promise<void>;
  onRotateDelta: (delta: RotationDelta) => void | Promise<void>;
  onScaleFactors: (factors: ScaleFactors) => void | Promise<void>;
  activeTool: string;
  holeDraft?: HoleDraft | null;
  referencePlanes?: ReferencePlane[];
  planeDraft?: PlaneDraft | null;
  planePreview?: ReferencePlane | null;
  onHoleFaceSelected?: (partId: string, point: THREE.Vector3, normal: THREE.Vector3) => void;
  onHoleUpdate?: (patch: Partial<HoleDraft>) => void;
  onHoleApply?: () => void;
  onHoleCancel?: () => void;
  onHoleUsePlane?: (planeId: string) => void;
  onPlaneReferenceSelected?: (reference: PlanePickReference) => void;
  onPlaneDraftChange?: (next: PlaneDraft | null) => void;
  onPlaneApply?: () => void;
  onPlaneCancel?: () => void;
  onToolCancel?: () => void;
};

function FitViewControl({
  partsGroupRef,
}: {
  partsGroupRef: React.RefObject<THREE.Group | null>;
}) {
  const { camera } = useThree();

  React.useEffect(() => {
    const group = partsGroupRef.current;

    if (!group || group.children.length === 0) return;

    const box = new THREE.Box3().setFromObject(group);

    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxSize = Math.max(
      size.x,
      size.y,
      size.z
    );

    const distance = Math.max(
      maxSize * 1.8,
      400
    );

    const direction = new THREE.Vector3(
      1,
      0.75,
      1
    ).normalize();

    camera.position.copy(
      center.clone().add(
        direction.multiplyScalar(distance)
      )
    );

    camera.lookAt(center);
  }, [camera, partsGroupRef]);

  return null;
}

function ViewportScene({
  parts,
  grid,
  measuredPartId,
  measuredPartIds,
  measurementRequest,
  onMeasurementChange,
  onMoveDelta,
  onRotateDelta,
  onScaleFactors,
  activeTool,
  holeDraft,
  referencePlanes,
  planeDraft,
  planePreview,
  onHoleFaceSelected,
  onHoleUpdate,
  onHoleApply,
  onHoleCancel,
  onHoleUsePlane,
  onPlaneReferenceSelected,
  onPlaneDraftChange,
  onPlaneApply,
  onPlaneCancel,
  onToolCancel,
  partsGroupRef,
}: Props & {
  partsGroupRef: React.RefObject<THREE.Group | null>;
}) {
  const meshRefs = React.useRef(new Map<string, THREE.Mesh>());
  const measurementBoxRef = React.useRef<THREE.Box3 | null>(null);
  const measurementBetweenBoxesRef = React.useRef<{ boxA: THREE.Box3; boxB: THREE.Box3 } | null>(null);
  const [measurement, setMeasurement] = React.useState<MeasurementResult | null>(null);
  const [gizmoCenter, setGizmoCenter] = React.useState<{ x: number; y: number; z: number } | null>(null);
  const [previewDelta, setPreviewDelta] = React.useState<MoveDelta>({ x: 0, y: 0, z: 0 });
  const [previewRotation, setPreviewRotation] = React.useState<RotationDelta>({ x: 0, y: 0, z: 0 });
  const [previewScale, setPreviewScale] = React.useState<ScaleFactors>({ x: 1, y: 1, z: 1 });
  const [contextualAxis, setContextualAxis] = React.useState<"x" | "y" | "z" | null>(null);
  const [contextualReference, setContextualReference] = React.useState<ContextualReference | null>(null);
  const selectedPartIds = useSelectionStore((state) => state.selectedPartIds);
  const clearSelection = useSelectionStore(
    (state) => state.clearSelection
  );

  const registerMesh = React.useCallback(
    (partId: string, mesh: THREE.Mesh | null) => {
      if (mesh) meshRefs.current.set(partId, mesh);
      else meshRefs.current.delete(partId);
    },
    []
  );

  React.useEffect(() => {
    if (measuredPartIds) return;

    if (!measuredPartId) {
      measurementBoxRef.current = null;
      measurementBetweenBoxesRef.current = null;
      setMeasurement(null);
      onMeasurementChange(null);
      return;
    }

    const mesh = meshRefs.current.get(measuredPartId);
    if (!mesh) {
      measurementBoxRef.current = null;
      setMeasurement(null);
      onMeasurementChange(null);
      return;
    }

    const nextMeasurement = measureWorldBoundingBox(
      mesh,
      measuredPartId
    );
    measurementBoxRef.current = nextMeasurement.box;
    const summary: MeasurementSummary = {
      target: nextMeasurement.target,
      width: nextMeasurement.width,
      height: nextMeasurement.height,
      depth: nextMeasurement.depth,
    };
    setMeasurement(summary);
    onMeasurementChange(summary);
  }, [measuredPartId, measuredPartIds, measurementRequest, onMeasurementChange]);

  React.useEffect(() => {
    if (!measuredPartIds) return;

    const meshA = meshRefs.current.get(measuredPartIds[0]);
    const meshB = meshRefs.current.get(measuredPartIds[1]);
    if (!meshA || !meshB) {
      measurementBetweenBoxesRef.current = null;
      setMeasurement(null);
      onMeasurementChange(null);
      return;
    }

    const nextMeasurement = measureBetweenParts(
      meshA,
      measuredPartIds[0],
      meshB,
      measuredPartIds[1]
    );
    measurementBetweenBoxesRef.current = {
      boxA: nextMeasurement.boxA,
      boxB: nextMeasurement.boxB,
    };
    setMeasurement(nextMeasurement.summary);
    onMeasurementChange(nextMeasurement.summary);
  }, [measuredPartIds, measurementRequest, onMeasurementChange]);

  React.useEffect(() => {
    if (activeTool === "none") {
      setContextualAxis(null);
      setContextualReference(null);
      setPreviewDelta({ x: 0, y: 0, z: 0 });
      setPreviewRotation({ x: 0, y: 0, z: 0 });
      setPreviewScale({ x: 1, y: 1, z: 1 });
      return;
    }

    if (activeTool !== "move" && activeTool !== "rotate" && activeTool !== "scale") {
      setContextualAxis(null);
      setContextualReference(null);
    }
  }, [activeTool]);

  React.useEffect(() => {
    if (selectedPartIds.length === 0) {
      setGizmoCenter(null);
      setContextualAxis(null);
      setContextualReference(null);
      setPreviewDelta({ x: 0, y: 0, z: 0 });
      setPreviewRotation({ x: 0, y: 0, z: 0 });
      setPreviewScale({ x: 1, y: 1, z: 1 });
      return;
    }

    const box = new THREE.Box3();
    let hasMesh = false;
    selectedPartIds.forEach((partId) => {
      const mesh = meshRefs.current.get(partId);
      if (!mesh) return;
      box.expandByObject(mesh);
      hasMesh = true;
    });

    if (!hasMesh) {
      setGizmoCenter(null);
      return;
    }

    const center = box.getCenter(new THREE.Vector3());
    if (contextualReference && contextualReference.partId && selectedPartIds.includes(contextualReference.partId)) {
      setGizmoCenter({ x: contextualReference.point.x, y: contextualReference.point.y, z: contextualReference.point.z });
      return;
    }

    setGizmoCenter({ x: center.x, y: center.y, z: center.z });
  }, [contextualReference, parts, selectedPartIds]);

  return (
    <>
      <SceneLighting />
      <GroundGrid grid={grid} />

      <group ref={partsGroupRef}>
        {parts.map((part, index) => (
          <PartMesh
            key={part.id}
            part={part}
            index={index}
            parts={parts}
            activeTool={activeTool}
            contextualAxis={contextualAxis}
            onReferenceSelect={(partId, axis, reference) => {
              if (partId !== part.id) return;
              setContextualAxis(axis);
              setContextualReference(reference ?? null);
            }}
            onHoleFaceSelected={onHoleFaceSelected}
            onPlaneReferenceSelected={onPlaneReferenceSelected}
            holeDraft={holeDraft}
            onMeshReady={registerMesh}
            previewDelta={previewDelta}
            previewRotation={previewRotation}
            previewScale={previewScale}
          />
        ))}
      </group>

      {activeTool !== "none" && contextualReference && !contextualReference.axis && (
        <Html position={contextualReference.point.clone().add(new THREE.Vector3(0, 20, 0))} center>
          <div
            style={{
              background: "rgba(15, 17, 21, 0.9)",
              border: "1px solid #4c5c70",
              borderRadius: "6px",
              padding: "6px 10px",
              color: "#e8edf3",
              fontSize: "11px",
              whiteSpace: "nowrap",
              boxShadow: "0 8px 22px rgba(0,0,0,0.28)",
            }}
          >
            Select a clearer face/edge reference
          </div>
        </Html>
      )}

      {referencePlanes?.filter((plane) => plane.visible).map((plane) => {
        const owner = parts.find((part) => part.id === plane.part_id) ?? parts[0];
        const size = owner ? planeVisualSizeFromPart(owner) : 120;
        const origin = new THREE.Vector3(plane.origin.x, plane.origin.y, plane.origin.z);
        const safeBasis = orthonormalBasis(plane.normal, plane.x_axis, plane.y_axis);
        const x = new THREE.Vector3(safeBasis.xAxis.x, safeBasis.xAxis.y, safeBasis.xAxis.z);
        const y = new THREE.Vector3(safeBasis.yAxis.x, safeBasis.yAxis.y, safeBasis.yAxis.z);
        const n = new THREE.Vector3(safeBasis.normal.x, safeBasis.normal.y, safeBasis.normal.z);
        const basis = new THREE.Matrix4().makeBasis(x, y, n);
        if (!Number.isFinite(origin.x + origin.y + origin.z + x.x + y.y + n.z)) return null;
        return (
          <group key={plane.id} position={origin} rotation={new THREE.Euler().setFromRotationMatrix(basis)}>
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                if (activeTool === "plane") {
                  onPlaneReferenceSelected?.({
                    partId: plane.part_id ?? "",
                    point: origin,
                    normal: n,
                    xAxis: x,
                    yAxis: y,
                    kind: "face",
                  });
                }
              }}
            >
              <planeGeometry args={[size, size]} />
              <meshBasicMaterial color="#3f86d8" transparent opacity={0.12} side={THREE.DoubleSide} />
            </mesh>
            <lineSegments>
              <edgesGeometry args={[new THREE.PlaneGeometry(size, size)]} />
              <lineBasicMaterial color="#61a3f2" />
            </lineSegments>
            <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), size * 0.35, 0xe86969]} />
            <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), size * 0.35, 0x67d18f]} />
            <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), size * 0.35, 0x74a8ff]} />
            <Html position={new THREE.Vector3(0, 0, 0)} center>
              <div style={{ background: "rgba(12,14,18,0.84)", color: "#dce8f7", border: "1px solid #35527a", borderRadius: "4px", fontSize: "10px", padding: "2px 6px" }}>
                {plane.name}
              </div>
            </Html>
          </group>
        );
      })}

      {activeTool === "plane" && planePreview && (() => {
        const owner = parts.find((part) => part.id === planePreview.part_id) ?? parts[0];
        const size = owner ? planeVisualSizeFromPart(owner) : 120;
        const origin = new THREE.Vector3(planePreview.origin.x, planePreview.origin.y, planePreview.origin.z);
        const safeBasis = orthonormalBasis(planePreview.normal, planePreview.x_axis, planePreview.y_axis);
        const x = new THREE.Vector3(safeBasis.xAxis.x, safeBasis.xAxis.y, safeBasis.xAxis.z);
        const y = new THREE.Vector3(safeBasis.yAxis.x, safeBasis.yAxis.y, safeBasis.yAxis.z);
        const n = new THREE.Vector3(safeBasis.normal.x, safeBasis.normal.y, safeBasis.normal.z);
        const basis = new THREE.Matrix4().makeBasis(x, y, n);
        if (!Number.isFinite(origin.x + origin.y + origin.z + x.x + y.y + n.z)) return null;
        return (
          <group position={origin} rotation={new THREE.Euler().setFromRotationMatrix(basis)}>
            <mesh>
              <planeGeometry args={[size, size]} />
              <meshBasicMaterial color="#5eb0ff" transparent opacity={0.22} side={THREE.DoubleSide} />
            </mesh>
            <lineSegments>
              <edgesGeometry args={[new THREE.PlaneGeometry(size, size)]} />
              <lineBasicMaterial color="#8ac2ff" />
            </lineSegments>
            <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), size * 0.4, 0xf07a7a]} />
            <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), size * 0.4, 0x82d89f]} />
            <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), size * 0.4, 0x8baeff]} />
            <Html position={new THREE.Vector3(0, 0, 0)} center>
              <div style={{ background: "rgba(17, 24, 31, 0.92)", border: "1px solid #4f84b8", borderRadius: "4px", color: "#e7f3ff", fontSize: "10px", padding: "3px 7px" }}>
                {planePreview.name} (preview)
              </div>
            </Html>
          </group>
        );
      })()}

      {activeTool === "hole" && holeDraft && (
        <>
          <group
            position={[holeDraft.origin.x, holeDraft.origin.y, holeDraft.origin.z]}
            rotation={new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
              new THREE.Vector3(holeDraft.xAxis.x, holeDraft.xAxis.y, holeDraft.xAxis.z),
              new THREE.Vector3(holeDraft.yAxis.x, holeDraft.yAxis.y, holeDraft.yAxis.z),
              new THREE.Vector3(holeDraft.normal.x, holeDraft.normal.y, holeDraft.normal.z),
            ))}
          >
            <mesh>
              <planeGeometry args={[80, 80]} />
              <meshBasicMaterial color="#51a7ff" transparent opacity={0.18} side={THREE.DoubleSide} />
            </mesh>
          </group>
          <Html position={new THREE.Vector3(holeDraft.origin.x, holeDraft.origin.y + 18, holeDraft.origin.z)} center>
            <div style={{ background: "rgba(17, 22, 29, 0.9)", border: "1px solid #3a5983", borderRadius: "6px", padding: "8px 10px", color: "#eaf3ff", fontSize: "11px", display: "flex", flexDirection: "column", gap: "6px", minWidth: "220px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#8aa4c6" }}>Hole</div>
              {referencePlanes && referencePlanes.length > 0 && (
                <label style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "6px", alignItems: "center" }}>
                  <span>Plane</span>
                  <select
                    value={holeDraft.referencePlaneId ?? ""}
                    onChange={(event) => onHoleUsePlane?.(event.target.value)}
                    style={{ width: "100%", background: "#0b0e12", color: "#fff", border: "1px solid #324458", borderRadius: "4px", padding: "4px 6px" }}
                  >
                    <option value="">Face</option>
                    {referencePlanes.map((plane) => (
                      <option key={plane.id} value={plane.id}>{plane.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "6px", alignItems: "center" }}>
                <span>Diameter</span>
                <input type="number" value={String(holeDraft.diameter)} onChange={(event) => onHoleUpdate?.({ diameter: Number(event.target.value) || 1 })} style={{ width: "100%", background: "#0b0e12", color: "#fff", border: "1px solid #324458", borderRadius: "4px", padding: "4px 6px" }} />
              </label>
              <label style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "6px", alignItems: "center" }}>
                <span>Depth</span>
                <input type="number" value={String(holeDraft.depth)} onChange={(event) => onHoleUpdate?.({ depth: Number(event.target.value) || 1 })} style={{ width: "100%", background: "#0b0e12", color: "#fff", border: "1px solid #324458", borderRadius: "4px", padding: "4px 6px" }} disabled={holeDraft.throughAll} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#dfeaf7" }}>
                <input type="checkbox" checked={holeDraft.throughAll} onChange={(event) => onHoleUpdate?.({ throughAll: event.target.checked, depth: event.target.checked ? holeDraft.depth : holeDraft.depth })} />
                Through All
              </label>
              <label style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: "6px", alignItems: "center" }}>
                <span>X</span>
                <input type="number" value={String(holeDraft.center.x)} onChange={(event) => onHoleUpdate?.({ center: { ...holeDraft.center, x: Number(event.target.value) || 0 } })} style={{ width: "100%", background: "#0b0e12", color: "#fff", border: "1px solid #324458", borderRadius: "4px", padding: "4px 6px" }} />
              </label>
              <label style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: "6px", alignItems: "center" }}>
                <span>Y</span>
                <input type="number" value={String(holeDraft.center.y)} onChange={(event) => onHoleUpdate?.({ center: { ...holeDraft.center, y: Number(event.target.value) || 0 } })} style={{ width: "100%", background: "#0b0e12", color: "#fff", border: "1px solid #324458", borderRadius: "4px", padding: "4px 6px" }} />
              </label>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button type="button" onClick={onHoleApply} style={{ flex: 1, background: "#2c5d87", color: "#eaf3ff", border: "1px solid #4b7eae", borderRadius: "4px", padding: "6px 8px" }}>Apply</button>
                <button type="button" onClick={onHoleCancel} style={{ flex: 1, background: "#2a2f38", color: "#eaf3ff", border: "1px solid #4d5664", borderRadius: "4px", padding: "6px 8px" }}>Cancel</button>
              </div>
            </div>
          </Html>
        </>
      )}

      {activeTool === "plane" && planeDraft && (
        <Html position={new THREE.Vector3(0, 140, 0)} center>
          <div style={{ background: "rgba(17, 22, 29, 0.92)", border: "1px solid #3a5983", borderRadius: "6px", padding: "8px 10px", color: "#eaf3ff", fontSize: "11px", display: "flex", flexDirection: "column", gap: "6px", minWidth: "290px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#8aa4c6" }}>Plane</div>
            <label style={{ display: "grid", gridTemplateColumns: "74px 1fr", gap: "6px", alignItems: "center" }}>
              <span>Type</span>
              <select
                value={planeDraft.type}
                onChange={(event) => onPlaneDraftChange?.({
                  ...planeDraft,
                  type: event.target.value as ReferencePlaneType,
                  sourcePlane: undefined,
                  sourcePlaneB: undefined,
                  pointA: undefined,
                  pointB: undefined,
                  pointC: undefined,
                  throughPoint: undefined,
                  lineStart: undefined,
                  lineEnd: undefined,
                  error: null,
                })}
                style={{ width: "100%", background: "#0b0e12", color: "#fff", border: "1px solid #324458", borderRadius: "4px", padding: "4px 6px" }}
              >
                <option value="origin_xy">Origin XY</option>
                <option value="origin_xz">Origin XZ</option>
                <option value="origin_yz">Origin YZ</option>
                <option value="offset">Offset</option>
                <option value="parallel_point">Parallel + Point</option>
                <option value="three_points">Three Points</option>
                <option value="normal_line_point">Normal to Line + Point</option>
                <option value="midplane">Midplane</option>
                <option value="tangent">Tangent</option>
                <option value="angle">Angle</option>
              </select>
            </label>
            <label style={{ display: "grid", gridTemplateColumns: "74px 1fr", gap: "6px", alignItems: "center" }}>
              <span>Name</span>
              <input
                value={planeDraft.name}
                onChange={(event) => onPlaneDraftChange?.({ ...planeDraft, name: event.target.value })}
                style={{ width: "100%", background: "#0b0e12", color: "#fff", border: "1px solid #324458", borderRadius: "4px", padding: "4px 6px" }}
              />
            </label>
            {(planeDraft.type === "offset" || planeDraft.type === "angle") && (
              <label style={{ display: "grid", gridTemplateColumns: "74px 1fr", gap: "6px", alignItems: "center" }}>
                <span>{planeDraft.type === "offset" ? "Distance" : "Angle"}</span>
                <input
                  type="number"
                  value={String(planeDraft.type === "offset" ? planeDraft.distance : planeDraft.angle)}
                  onChange={(event) => onPlaneDraftChange?.({
                    ...planeDraft,
                    [planeDraft.type === "offset" ? "distance" : "angle"]: Number(event.target.value) || 0,
                  })}
                  style={{ width: "100%", background: "#0b0e12", color: "#fff", border: "1px solid #324458", borderRadius: "4px", padding: "4px 6px" }}
                />
              </label>
            )}
            {(planeDraft.type === "offset" || planeDraft.type === "angle") && (
              <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={planeDraft.flip}
                  onChange={(event) => onPlaneDraftChange?.({ ...planeDraft, flip: event.target.checked })}
                />
                Flip
              </label>
            )}
            <div style={{ color: "#9db2c9", fontSize: "10px" }}>
              Pick references in viewport according to selected plane type.
            </div>
            {planeDraft.error && (
              <div style={{ color: "#ff9fa7", fontSize: "10px" }}>{planeDraft.error}</div>
            )}
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button type="button" onClick={onPlaneApply} style={{ flex: 1, background: "#2c5d87", color: "#eaf3ff", border: "1px solid #4b7eae", borderRadius: "4px", padding: "6px 8px" }}>Apply</button>
              <button type="button" onClick={onPlaneCancel} style={{ flex: 1, background: "#2a2f38", color: "#eaf3ff", border: "1px solid #4d5664", borderRadius: "4px", padding: "6px 8px" }}>Cancel</button>
            </div>
          </div>
        </Html>
      )}

      <MeasurementOverlay
        measurement={measurement}
        box={measurementBoxRef.current}
        betweenBoxes={measurementBetweenBoxesRef.current}
      />

      <TransformGizmo
        mode={activeTool === "move" || activeTool === "rotate" || activeTool === "scale" ? activeTool : null}
        center={
          gizmoCenter
            ? new THREE.Vector3(
                gizmoCenter.x + previewDelta.x,
                gizmoCenter.y + (activeTool === "move" ? previewDelta.y : 0),
                gizmoCenter.z + (activeTool === "move" ? previewDelta.z : 0)
              )
            : null
        }
        selectedAxis={activeTool === "move" || activeTool === "rotate" || activeTool === "scale" ? contextualAxis : null}
        onMovePreview={setPreviewDelta}
        onMoveCommit={async (delta) => {
          setPreviewDelta({ x: 0, y: 0, z: 0 });
          await onMoveDelta(delta);
          setContextualAxis(null);
        }}
        onRotatePreview={setPreviewRotation}
        onRotateCommit={async (delta) => {
          setPreviewRotation({ x: 0, y: 0, z: 0 });
          await onRotateDelta(delta);
        }}
        onScalePreview={setPreviewScale}
        onScaleCommit={async (factors) => {
          setPreviewScale({ x: 1, y: 1, z: 1 });
          await onScaleFactors(factors);
        }}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={100}
        maxDistance={2500}
      />

      <GizmoHelper
        alignment="bottom-right"
        margin={[70, 70]}
      >
        <GizmoViewport
          axisColors={[
            "#e45b5b",
            "#62c978",
            "#5d8fe8",
          ]}
          labelColor="#ffffff"
        />
      </GizmoHelper>

      <mesh
        visible={false}
        position={[0, -1, 0]}
        onClick={(event) => {
          if (
            event.nativeEvent.metaKey ||
            event.nativeEvent.ctrlKey
          ) {
            return;
          }

          clearSelection();
        }}
      >
        <planeGeometry args={[5000, 5000]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

function Viewport3D({
  parts,
  grid,
  measuredPartId,
  measuredPartIds,
  measurementRequest,
  onMeasurementChange,
  onMoveDelta,
  onRotateDelta,
  onScaleFactors,
  activeTool,
  holeDraft,
  referencePlanes,
  planeDraft,
  planePreview,
  onHoleFaceSelected,
  onHoleUpdate,
  onHoleApply,
  onHoleCancel,
  onHoleUsePlane,
  onPlaneReferenceSelected,
  onPlaneDraftChange,
  onPlaneApply,
  onPlaneCancel,
  onToolCancel,
}: Props) {
  const partsGroupRef = React.useRef<THREE.Group>(null);

  return (
    <section
      style={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        position: "relative",
        background: "#0f1115",
        overflow: "hidden",
      }}
    >
      <Canvas
        camera={{
          position: [600, 450, 700],
          fov: 45,
          near: 0.1,
          far: 5000,
        }}
        gl={{ antialias: true }}
        onCreated={({ camera }) => camera.lookAt(0, 100, 0)}
      >
        <color attach="background" args={["#0f1115"]} />
        <ViewportScene
          parts={parts}
          grid={grid}
          measuredPartId={measuredPartId}
          measuredPartIds={measuredPartIds}
          measurementRequest={measurementRequest}
          onMeasurementChange={onMeasurementChange}
          onMoveDelta={onMoveDelta}
          onRotateDelta={onRotateDelta}
          onScaleFactors={onScaleFactors}
          activeTool={activeTool}
          holeDraft={holeDraft}
          referencePlanes={referencePlanes}
          planeDraft={planeDraft}
          planePreview={planePreview}
          onHoleFaceSelected={onHoleFaceSelected}
          onHoleUpdate={onHoleUpdate}
          onHoleApply={onHoleApply}
          onHoleCancel={onHoleCancel}
          onHoleUsePlane={onHoleUsePlane}
          onPlaneReferenceSelected={onPlaneReferenceSelected}
          onPlaneDraftChange={onPlaneDraftChange}
          onPlaneApply={onPlaneApply}
          onPlaneCancel={onPlaneCancel}
          partsGroupRef={partsGroupRef}
        />
        <FitViewControl partsGroupRef={partsGroupRef} />
      </Canvas>
      <div
        style={{
          position: "absolute",
          left: "16px",
          bottom: "16px",
          padding: "7px 10px",
          borderRadius: "6px",
          background: "rgba(20, 23, 29, 0.88)",
          border: "1px solid #2a3039",
          color: "#7f8998",
          fontSize: "11px",
          pointerEvents: "none",
        }}
      >
        Orbit · Zoom · Pan
      </div>
    </section>
  );
}

export default Viewport3D;
