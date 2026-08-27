import * as THREE from "three";

export type MeasureTarget =
  | { kind: "bounding-box"; partId: string }
  | { kind: "vertex"; partId: string; index: number }
  | { kind: "edge"; partId: string; index: number }
  | { kind: "face"; partId: string; index: number }
  | { kind: "part"; partId: string };

export type BoundingBoxMeasurement = {
  target: Extract<MeasureTarget, { kind: "bounding-box" }>;
  box: THREE.Box3;
  width: number;
  height: number;
  depth: number;
};

export type MeasurementSummary = Omit<BoundingBoxMeasurement, "box">;

export type BetweenPartsMeasurement = {
  target: {
    kind: "between-parts";
    partAId: string;
    partBId: string;
  };
  distance: number;
  deltaX: number;
  deltaY: number;
  deltaZ: number;
};

export type MeasurementResult =
  | MeasurementSummary
  | BetweenPartsMeasurement;

export function measureWorldBoundingBox(
  object: THREE.Object3D,
  partId: string
): BoundingBoxMeasurement {
  object.updateWorldMatrix(true, false);

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());

  return {
    target: { kind: "bounding-box", partId },
    box,
    width: size.x,
    height: size.y,
    depth: size.z,
  };
}

export function measureBetweenParts(
  objectA: THREE.Object3D,
  partAId: string,
  objectB: THREE.Object3D,
  partBId: string
): {
  boxA: THREE.Box3;
  boxB: THREE.Box3;
  summary: BetweenPartsMeasurement;
} {
  objectA.updateWorldMatrix(true, false);
  objectB.updateWorldMatrix(true, false);

  const boxA = new THREE.Box3().setFromObject(objectA);
  const boxB = new THREE.Box3().setFromObject(objectB);
  const centerA = boxA.getCenter(new THREE.Vector3());
  const centerB = boxB.getCenter(new THREE.Vector3());
  const delta = centerB.clone().sub(centerA);

  return {
    boxA,
    boxB,
    summary: {
      target: { kind: "between-parts", partAId, partBId },
      distance: centerA.distanceTo(centerB),
      deltaX: delta.x,
      deltaY: delta.y,
      deltaZ: delta.z,
    },
  };
}
