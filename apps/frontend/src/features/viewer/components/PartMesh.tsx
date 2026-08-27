import { useMemo } from "react";
import * as THREE from "three";
import { useSelectionStore } from "../../../shared/state/selectionStore";
import type { Part } from "../../parts/types";
import {
  getPartPosition,
  getPartRotation,
  getPartScale,
} from "../partPosition";
import { buildHoleGeometry, type HoleDraftData } from "../holeGeometry";

type ContextualReference = {
  partId: string;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  axis: "x" | "y" | "z" | null;
  kind: "face" | "edge" | "vertex" | "axis";
};

type PlanePickReference = {
  partId: string;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  xAxis: THREE.Vector3;
  yAxis: THREE.Vector3;
  kind: "face" | "point";
};

type Props = {
  part: Part;
  index: number;
  parts: Part[];
  activeTool?: string;
  contextualAxis?: "x" | "y" | "z" | null;
  onReferenceSelect?: (partId: string, axis: "x" | "y" | "z" | null, reference?: ContextualReference) => void;
  onHoleFaceSelected?: (partId: string, point: THREE.Vector3, normal: THREE.Vector3) => void;
  onPlaneReferenceSelected?: (reference: PlanePickReference) => void;
  holeDraft?: HoleDraftData | null;
  onMeshReady?: (partId: string, mesh: THREE.Mesh | null) => void;
  previewDelta?: { x: number; y: number; z: number };
  previewRotation?: { x: number; y: number; z: number };
  previewScale?: { x: number; y: number; z: number };
};

function inferAxisFromVector(vector: THREE.Vector3): "x" | "y" | "z" | null {
  const abs = new THREE.Vector3(
    Math.abs(vector.x),
    Math.abs(vector.y),
    Math.abs(vector.z)
  );
  const maxAxis = abs.x > abs.y ? "x" : "y";
  const dominantAxis = abs.z > abs[maxAxis] ? "z" : maxAxis;

  if (abs[dominantAxis] < 0.15) {
    return null;
  }

  return dominantAxis;
}

function PartMesh({ part, index, parts, activeTool, contextualAxis, onReferenceSelect, onHoleFaceSelected, onPlaneReferenceSelected, holeDraft, onMeshReady, previewDelta, previewRotation: previewRotationDelta, previewScale }: Props) {
  const selectedPartIds = useSelectionStore(
    (state) => state.selectedPartIds
  );
  const hoveredPartId = useSelectionStore(
    (state) => state.hoveredPartId
  );
  const setSelectedPart = useSelectionStore(
    (state) => state.setSelectedPart
  );
  const toggleSelectedPart = useSelectionStore(
    (state) => state.toggleSelectedPart
  );
  const setHoveredPart = useSelectionStore(
    (state) => state.setHoveredPart
  );

  const selected = selectedPartIds.includes(part.id);
  const hovered = hoveredPartId === part.id;

  const width = Number(part.parameters.width ?? 100);
  const depth = Number(part.parameters.depth ?? 100);
  const height = Number(
    part.parameters.height ??
      part.parameters.thickness ??
      20
  );

  const partWorldMatrix = useMemo(() => {
    const position = getPartPosition(part, index, parts);
    const rotation = getPartRotation(part);
    const scale = getPartScale(part);
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(rotation.x),
        THREE.MathUtils.degToRad(rotation.y),
        THREE.MathUtils.degToRad(rotation.z)
      )
    );
    return new THREE.Matrix4().compose(
      new THREE.Vector3(position.x, position.y, position.z),
      quaternion,
      new THREE.Vector3(scale.x, scale.y, scale.z)
    );
  }, [part, index, parts]);

  const geometry = useMemo(() => {
    const geometryType = part.geometry?.type;
    const features = part.features as Record<string, unknown> | undefined;
    const holeFeature = features?.cad as Record<string, unknown> | undefined;
    const hasHoleFeature = !!(
      (holeFeature?.hole as unknown) ||
      (holeFeature?.holes as unknown) ||
      features?.hole ||
      features?.holes
    );

    if (hasHoleFeature || (activeTool === "hole" && holeDraft?.partId === part.id)) {
      const result = buildHoleGeometry(
        part,
        activeTool === "hole" && holeDraft?.partId === part.id ? holeDraft : undefined,
        partWorldMatrix
      );
      if (result) return result;
    }

    if (geometryType === "angle_bracket") {
      const thickness = Number(
        part.parameters.thickness ?? 6
      );

      // Perfil en L:
      //
      //  ┌──────────────
      //  │
      //  │
      //  │
      //
      // Se extruye en Z para crear una escuadra 3D.
      const shape = new THREE.Shape();

      shape.moveTo(0, 0);
      shape.lineTo(width, 0);
      shape.lineTo(width, thickness);
      shape.lineTo(thickness, thickness);
      shape.lineTo(thickness, height);
      shape.lineTo(0, height);
      shape.closePath();

      const extruded = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 1,
      });

      // Centrar la geometría para que conserve el mismo
      // sistema de coordenadas que las BoxGeometry.
      extruded.translate(
        -width / 2,
        -height / 2,
        -thickness / 2
      );

      return extruded;
    }

    // Box y Lid mantienen la geometría existente.
    return new THREE.BoxGeometry(
      width,
      height,
      depth
    );
  }, [
    part.geometry?.type,
    width,
    height,
    depth,
    part.parameters.thickness,
    part.features,
    activeTool,
    holeDraft,
    partWorldMatrix,
  ]);

  const hasTransformActive =
    activeTool === "move" ||
    activeTool === "rotate" ||
    activeTool === "scale";

  const isSelectedInTransform =
    hasTransformActive && selectedPartIds.includes(part.id);

  const basePosition = (() => {
    const position = getPartPosition(part, index, parts);
    return [
      position.x,
      position.y,
      position.z,
    ] as [number, number, number];
  })();

  const baseRotation = (() => {
    const rotation = getPartRotation(part);
    return [
      THREE.MathUtils.degToRad(rotation.x),
      THREE.MathUtils.degToRad(rotation.y),
      THREE.MathUtils.degToRad(rotation.z),
    ] as [number, number, number];
  })();

  const baseScale = (() => {
    const scale = getPartScale(part);
    return [
      scale.x,
      scale.y,
      scale.z,
    ] as [number, number, number];
  })();

  const previewPosition = (() => {
    const position = getPartPosition(part, index, parts);
    const delta = selected ? previewDelta : undefined;
    return [
      position.x + (delta?.x ?? 0),
      position.y + (delta?.y ?? 0),
      position.z + (delta?.z ?? 0),
    ] as [number, number, number];
  })();

  const rotationPreview = (() => {
    const rotation = getPartRotation(part);
    const delta = selected ? previewRotationDelta : undefined;
    return [
      THREE.MathUtils.degToRad(rotation.x + (delta?.x ?? 0)),
      THREE.MathUtils.degToRad(rotation.y + (delta?.y ?? 0)),
      THREE.MathUtils.degToRad(rotation.z + (delta?.z ?? 0)),
    ] as [number, number, number];
  })();

  const previewScaleValues = (() => {
    const scale = getPartScale(part);
    const factors = selected ? previewScale : undefined;
    return [
      scale.x * (factors?.x ?? 1),
      scale.y * (factors?.y ?? 1),
      scale.z * (factors?.z ?? 1),
    ] as [number, number, number];
  })();

  const hasPreviewTransform =
    selected &&
    ((activeTool === "move" && (previewDelta?.x !== 0 || previewDelta?.y !== 0 || previewDelta?.z !== 0)) ||
      (activeTool === "rotate" && (previewRotationDelta?.x !== 0 || previewRotationDelta?.y !== 0 || previewRotationDelta?.z !== 0)) ||
      (activeTool === "scale" && (previewScale?.x !== 1 || previewScale?.y !== 1 || previewScale?.z !== 1)));

  const baseOpacity = isSelectedInTransform && contextualAxis !== null
    ? 0.35
    : selected
      ? 1
      : selectedPartIds.length > 0
        ? 0.38
        : hovered
          ? 0.9
          : 1;

  return (
    <>
      <mesh
        ref={(mesh) => onMeshReady?.(part.id, mesh)}
        geometry={geometry}
        position={basePosition}
        rotation={baseRotation}
        onClick={(event) => {
          event.stopPropagation();

          if (
            hasTransformActive &&
            selectedPartIds.includes(part.id)
          ) {
            const mesh = event.object as THREE.Mesh;
            const faceNormal = event.face?.normal ? event.face.normal.clone() : new THREE.Vector3(0, 1, 0);
            const worldNormal = faceNormal.transformDirection(mesh.matrixWorld).normalize();
            const axis = inferAxisFromVector(worldNormal);
            const reference: ContextualReference = {
              partId: part.id,
              point: event.point.clone(),
              normal: worldNormal,
              axis,
              kind: event.face ? "face" : "vertex",
            };

            onReferenceSelect?.(part.id, axis, reference);
            return;
          }

          if (activeTool === "hole" && selectedPartIds.includes(part.id)) {
            const mesh = event.object as THREE.Mesh;
            const faceNormal = event.face?.normal
              ? event.face.normal.clone()
              : new THREE.Vector3(0, 1, 0);
            const worldNormal = faceNormal
              .transformDirection(mesh.matrixWorld)
              .normalize();
            onHoleFaceSelected?.(part.id, event.point.clone(), worldNormal);
            return;
          }

          if (activeTool === "plane" && selectedPartIds.includes(part.id)) {
            const mesh = event.object as THREE.Mesh;
            const faceNormal = event.face?.normal
              ? event.face.normal.clone()
              : new THREE.Vector3(0, 1, 0);
            const worldNormal = faceNormal
              .transformDirection(mesh.matrixWorld)
              .normalize();
            const up = Math.abs(worldNormal.y) > 0.9
              ? new THREE.Vector3(0, 0, 1)
              : new THREE.Vector3(0, 1, 0);
            let xAxis = new THREE.Vector3().crossVectors(up, worldNormal);
            if (xAxis.lengthSq() < 1e-8) {
              xAxis = new THREE.Vector3(1, 0, 0).cross(worldNormal);
            }
            xAxis.normalize();
            const yAxis = new THREE.Vector3().crossVectors(xAxis, worldNormal).normalize();
            onPlaneReferenceSelected?.({
              partId: part.id,
              point: event.point.clone(),
              normal: worldNormal,
              xAxis,
              yAxis,
              kind: event.face ? "face" : "point",
            });
            return;
          }

          if (event.nativeEvent.metaKey || event.nativeEvent.ctrlKey) {
            toggleSelectedPart(part.id);
            return;
          }

          setSelectedPart(part.id);
        }}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setHoveredPart(part.id);
        }}
        onPointerLeave={() => {
          setHoveredPart(null);
        }}
        scale={baseScale}
      >
        <meshStandardMaterial
          color={selected ? "#d7dde5" : "#aeb5bf"}
          metalness={0.05}
          roughness={0.78}
          transparent
          opacity={baseOpacity}
          depthWrite={baseOpacity > 0.9}
          emissive={selected ? "#53677d" : "#000000"}
          emissiveIntensity={selected ? 0.35 : 0}
        />
      </mesh>

      {hasPreviewTransform && (
        <mesh
          geometry={geometry}
          position={activeTool === "move" ? previewPosition : basePosition}
          rotation={activeTool === "rotate" ? rotationPreview : baseRotation}
          scale={activeTool === "scale" ? previewScaleValues : baseScale}
          raycast={() => null}
        >
          <meshStandardMaterial
            color={selected ? "#f3f8ff" : "#c9d4e4"}
            metalness={0.06}
            roughness={0.7}
            transparent
            opacity={1}
            emissive={selected ? "#3a5f8f" : "#000000"}
            emissiveIntensity={selected ? 0.55 : 0}
            depthWrite={true}
          />
        </mesh>
      )}
    </>
  );
}

export default PartMesh;
