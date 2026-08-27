import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

import type { Part } from "../parts/types";

export type HoleFeatureData = {
  id?: string;
  partId?: string;
  part_id?: string;
  diameter?: number;
  depth?: number;
  throughAll?: boolean;
  through_all?: boolean;
  position?: { x: number; y: number; z: number };
  normal?: { x: number; y: number; z: number };
  center?: { x: number; y: number };
  reference_plane?: {
    origin?: { x: number; y: number; z: number };
    normal?: { x: number; y: number; z: number };
    x_axis?: { x: number; y: number; z: number };
    y_axis?: { x: number; y: number; z: number };
  };
};

export type HoleDraftData = {
  partId: string;
  origin: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  xAxis: { x: number; y: number; z: number };
  yAxis: { x: number; y: number; z: number };
  diameter: number;
  depth: number;
  throughAll: boolean;
  center: { x: number; y: number };
};

const MAX_CSG_MS = 160;

function roundKey(value: number, precision = 1000) {
  if (!Number.isFinite(value)) return "nan";
  return String(Math.round(value * precision) / precision);
}

function holeSignature(feature: HoleFeatureData) {
  const position = feature.position ?? { x: 0, y: 0, z: 0 };
  const normal = feature.normal ?? { x: 0, y: 0, z: 1 };
  const center = feature.center ?? { x: 0, y: 0 };
  const throughAll = Boolean(
    feature.throughAll ?? feature.through_all ?? feature.depth == null
  );

  return [
    roundKey(Number(feature.diameter ?? 0), 100),
    throughAll ? "T" : "B",
    roundKey(Number(feature.depth ?? 0), 100),
    roundKey(Number(position.x ?? 0)),
    roundKey(Number(position.y ?? 0)),
    roundKey(Number(position.z ?? 0)),
    roundKey(Number(normal.x ?? 0)),
    roundKey(Number(normal.y ?? 0)),
    roundKey(Number(normal.z ?? 1)),
    roundKey(Number(center.x ?? 0), 100),
    roundKey(Number(center.y ?? 0), 100),
  ].join("|");
}

function uniqueHoleFeatures(features: HoleFeatureData[]) {
  const seen = new Set<string>();
  const unique: HoleFeatureData[] = [];
  for (const feature of features) {
    const key = holeSignature(feature);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(feature);
  }
  return unique;
}

function coerceVec3(value?: { x?: number; y?: number; z?: number } | null, fallback = new THREE.Vector3()): THREE.Vector3 {
  if (!value) return fallback.clone();
  return new THREE.Vector3(
    Number(value.x ?? fallback.x),
    Number(value.y ?? fallback.y),
    Number(value.z ?? fallback.z)
  );
}

export function getHoleFeature(part: Part): HoleFeatureData | null {
  return getHoleFeatures(part)[0] ?? null;
}

export function getHoleFeatures(part: Part): HoleFeatureData[] {
  const features = part.features as Record<string, unknown> | undefined;
  const cad = (part.features as Record<string, unknown> | undefined)?.cad as Record<string, unknown> | undefined;
  const holes = cad?.holes;
  if (Array.isArray(holes)) return holes as HoleFeatureData[];
  const legacy = (cad?.hole as HoleFeatureData | undefined) ?? (part.features as Record<string, unknown> | undefined)?.hole as HoleFeatureData | undefined;
  if (legacy) return [legacy];
  const topLevelHoles = features?.holes;
  return Array.isArray(topLevelHoles) ? topLevelHoles as HoleFeatureData[] : [];
}

export function buildHoleGeometry(
  part: Part,
  draft?: HoleDraftData,
  partWorldMatrix?: THREE.Matrix4
): THREE.BufferGeometry | null {
  const holeFeatures: HoleFeatureData[] = draft
    ? [{
        partId: draft.partId,
        diameter: draft.diameter,
        depth: draft.depth,
        throughAll: draft.throughAll,
        center: draft.center,
        position: draft.origin,
        normal: draft.normal,
        reference_plane: {
          origin: draft.origin,
          normal: draft.normal,
          x_axis: draft.xAxis,
          y_axis: draft.yAxis,
        },
      }]
    : uniqueHoleFeatures(getHoleFeatures(part));
  if (holeFeatures.length === 0) return null;

  const width = Number(part.parameters.width ?? 100);
  const height = Number(part.parameters.height ?? part.parameters.thickness ?? 20);
  const depth = Number(part.parameters.depth ?? 100);
  const baseGeometry = new THREE.BoxGeometry(width, height, depth);
  const worldToLocal = partWorldMatrix
    ? partWorldMatrix.clone().invert()
    : null;
  const normalMatrix = worldToLocal
    ? new THREE.Matrix3().getNormalMatrix(worldToLocal)
    : null;
  try {
    const evaluator = new Evaluator();
    let result = new Brush(baseGeometry);
    result.updateMatrixWorld(true);
    const startedAt = performance.now();

    for (const holeFeature of holeFeatures) {
      if (performance.now() - startedAt > MAX_CSG_MS) {
        console.warn("Hole CSG time budget exceeded; partial result rendered for responsiveness");
        break;
      }

      const diameter = Math.max(1, Number(holeFeature.diameter ?? 10));
      const radius = diameter / 2;
      const throughAll = Boolean(
        holeFeature.throughAll ?? holeFeature.through_all ?? holeFeature.depth == null
      );
      const holeDepth = throughAll
        ? Math.max(width, height, depth) * 2.5
        : Math.max(0.001, Number(holeFeature.depth ?? 0));
      if (!Number.isFinite(holeDepth) || holeDepth <= 0) continue;

      const referencePlane = holeFeature.reference_plane ?? {
        origin: holeFeature.position ?? { x: 0, y: 0, z: 0 },
        normal: holeFeature.normal ?? { x: 0, y: 0, z: 1 },
        x_axis: { x: 1, y: 0, z: 0 },
        y_axis: { x: 0, y: 1, z: 0 },
      };
      const originWorld = coerceVec3(referencePlane.origin, new THREE.Vector3(0, 0, 0));
      const normalWorld = coerceVec3(referencePlane.normal, new THREE.Vector3(0, 0, 1)).normalize();
      const xAxisWorld = coerceVec3(referencePlane.x_axis, new THREE.Vector3(1, 0, 0)).normalize();
      const yAxisWorld = coerceVec3(referencePlane.y_axis, new THREE.Vector3(0, 1, 0)).normalize();
      const origin = worldToLocal
        ? originWorld.clone().applyMatrix4(worldToLocal)
        : originWorld;
      const normal = normalMatrix
        ? normalWorld.clone().applyMatrix3(normalMatrix).normalize()
        : normalWorld;
      let xAxis = normalMatrix
        ? xAxisWorld.clone().applyMatrix3(normalMatrix).normalize()
        : xAxisWorld;
      const hintYAxis = normalMatrix
        ? yAxisWorld.clone().applyMatrix3(normalMatrix).normalize()
        : yAxisWorld;

      // Rebuild an orthonormal right-handed basis in local space.
      xAxis = xAxis.sub(normal.clone().multiplyScalar(xAxis.dot(normal)));
      if (xAxis.lengthSq() < 1e-8) {
        const fallback = Math.abs(normal.y) > 0.9
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(0, 1, 0);
        xAxis = new THREE.Vector3().crossVectors(fallback, normal);
      }
      xAxis.normalize();

      let yAxis = new THREE.Vector3().crossVectors(xAxis, normal).normalize();
      if (yAxis.dot(hintYAxis) < 0) {
        yAxis.multiplyScalar(-1);
        xAxis.multiplyScalar(-1);
      }
      const center = holeFeature.center ?? { x: 0, y: 0 };
      const holeCenter = origin.clone()
        .addScaledVector(xAxis, Number(center.x ?? 0))
        .addScaledVector(yAxis, Number(center.y ?? 0));
      const radialSegments = holeFeatures.length > 8 ? 14 : 20;
      const holeBrush = new Brush(
        new THREE.CylinderGeometry(radius, radius, holeDepth, radialSegments, 1, false)
      );
      holeBrush.position.copy(holeCenter).addScaledVector(normal, -holeDepth / 2);
      holeBrush.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(xAxis.clone(), normal.clone(), yAxis.clone())
      );
      holeBrush.updateMatrixWorld(true);
      result = evaluator.evaluate(result, holeBrush, SUBTRACTION);
      result.updateMatrixWorld(true);
    }
    if (result.geometry.attributes.position && result.geometry.attributes.position.count < 250000) {
      result.geometry.computeVertexNormals();
    }
    return result.geometry;
  } catch (error) {
    console.warn("Hole boolean subtraction failed", error);
  }

  return null;
}
