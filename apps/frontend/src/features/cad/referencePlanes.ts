import * as THREE from "three";

export type Vec3 = { x: number; y: number; z: number };

export type ReferencePlaneType =
  | "origin_xy"
  | "origin_xz"
  | "origin_yz"
  | "offset"
  | "parallel_point"
  | "three_points"
  | "normal_line_point"
  | "midplane"
  | "tangent"
  | "angle";

export type ReferencePlane = {
  id: string;
  name: string;
  type: ReferencePlaneType | string;
  part_id?: string;
  origin: Vec3;
  normal: Vec3;
  x_axis: Vec3;
  y_axis: Vec3;
  visible: boolean;
  references: Record<string, unknown>;
  parameters: Record<string, unknown>;
  locked: boolean;
};

export type PlanePickReference = {
  partId: string;
  point: Vec3;
  normal: Vec3;
  xAxis: Vec3;
  yAxis: Vec3;
  kind: "face" | "point";
};

const EPS = 1e-8;

function toVector(v: Vec3) {
  return new THREE.Vector3(v.x, v.y, v.z);
}

function fromVector(v: THREE.Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function orthonormalBasis(normal: Vec3, xHint?: Vec3, yHint?: Vec3) {
  const n = toVector(normal).normalize();
  let x = xHint ? toVector(xHint) : new THREE.Vector3(1, 0, 0);
  x.sub(n.clone().multiplyScalar(x.dot(n)));

  if (x.lengthSq() < EPS) {
    const fallback = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    x = new THREE.Vector3().crossVectors(fallback, n);
  }
  x.normalize();

  let y = new THREE.Vector3().crossVectors(x, n).normalize();
  if (yHint) {
    const hint = toVector(yHint).normalize();
    if (y.dot(hint) < 0) {
      y.multiplyScalar(-1);
      x.multiplyScalar(-1);
    }
  }

  return {
    normal: fromVector(n),
    xAxis: fromVector(x),
    yAxis: fromVector(y),
  };
}

export function planeFromFace(
  id: string,
  name: string,
  partId: string,
  origin: Vec3,
  normal: Vec3,
  xHint?: Vec3,
  yHint?: Vec3,
  type: ReferencePlaneType = "offset"
): ReferencePlane {
  const basis = orthonormalBasis(normal, xHint, yHint);
  return {
    id,
    name,
    type,
    part_id: partId,
    origin,
    normal: basis.normal,
    x_axis: basis.xAxis,
    y_axis: basis.yAxis,
    visible: true,
    references: {},
    parameters: {},
    locked: false,
  };
}

export function createOffsetPlane(
  id: string,
  name: string,
  source: ReferencePlane,
  distance: number,
  flip: boolean
): ReferencePlane {
  const n = toVector(source.normal).normalize();
  const dir = flip ? -1 : 1;
  const origin = toVector(source.origin).addScaledVector(n, distance * dir);
  const basis = orthonormalBasis(fromVector(n), source.x_axis, source.y_axis);
  return {
    id,
    name,
    type: "offset",
    part_id: source.part_id,
    origin: fromVector(origin),
    normal: basis.normal,
    x_axis: basis.xAxis,
    y_axis: basis.yAxis,
    visible: true,
    references: {
      source: { id: source.id, normal: source.normal, origin: source.origin },
    },
    parameters: { distance, flip },
    locked: false,
  };
}

export function createParallelThroughPoint(
  id: string,
  name: string,
  source: ReferencePlane,
  point: Vec3
): ReferencePlane {
  const basis = orthonormalBasis(source.normal, source.x_axis, source.y_axis);
  return {
    id,
    name,
    type: "parallel_point",
    part_id: source.part_id,
    origin: point,
    normal: basis.normal,
    x_axis: basis.xAxis,
    y_axis: basis.yAxis,
    visible: true,
    references: {
      plane: { id: source.id, normal: source.normal, origin: source.origin },
      point,
    },
    parameters: {},
    locked: false,
  };
}

export function createThreePointsPlane(
  id: string,
  name: string,
  partId: string,
  p1: Vec3,
  p2: Vec3,
  p3: Vec3
): ReferencePlane {
  const v1 = toVector(p2).sub(toVector(p1));
  const v2 = toVector(p3).sub(toVector(p1));
  const n = new THREE.Vector3().crossVectors(v1, v2);
  if (n.lengthSq() <= EPS) {
    throw new Error("Three points are collinear");
  }
  const basis = orthonormalBasis(fromVector(n), fromVector(v1.normalize()));
  return {
    id,
    name,
    type: "three_points",
    part_id: partId,
    origin: p1,
    normal: basis.normal,
    x_axis: basis.xAxis,
    y_axis: basis.yAxis,
    visible: true,
    references: { p1, p2, p3 },
    parameters: {},
    locked: false,
  };
}

export function createNormalLinePlane(
  id: string,
  name: string,
  partId: string,
  lineStart: Vec3,
  lineEnd: Vec3,
  point: Vec3
): ReferencePlane {
  const direction = toVector(lineEnd).sub(toVector(lineStart));
  if (direction.lengthSq() <= EPS) {
    throw new Error("Line direction is not valid");
  }
  const basis = orthonormalBasis(fromVector(direction.normalize()));
  return {
    id,
    name,
    type: "normal_line_point",
    part_id: partId,
    origin: point,
    normal: basis.normal,
    x_axis: basis.xAxis,
    y_axis: basis.yAxis,
    visible: true,
    references: { line_start: lineStart, line_end: lineEnd, point, direction: basis.normal },
    parameters: {},
    locked: false,
  };
}

export function createMidplane(
  id: string,
  name: string,
  planeA: ReferencePlane,
  planeB: ReferencePlane
): ReferencePlane {
  const na = toVector(planeA.normal).normalize();
  const nb = toVector(planeB.normal).normalize();
  if (Math.abs(Math.abs(na.dot(nb)) - 1) > 1e-3) {
    throw new Error("Selected planes are not parallel");
  }

  const a = toVector(planeA.origin);
  const b = toVector(planeB.origin);
  const origin = a.clone().add(b).multiplyScalar(0.5);
  const sameDirection = na.dot(nb) >= 0;
  const normal = sameDirection ? na : na.clone().multiplyScalar(-1);
  const basis = orthonormalBasis(fromVector(normal), planeA.x_axis, planeA.y_axis);
  return {
    id,
    name,
    type: "midplane",
    part_id: planeA.part_id,
    origin: fromVector(origin),
    normal: basis.normal,
    x_axis: basis.xAxis,
    y_axis: basis.yAxis,
    visible: true,
    references: {
      plane_a: { id: planeA.id, origin: planeA.origin, normal: planeA.normal },
      plane_b: { id: planeB.id, origin: planeB.origin, normal: planeB.normal },
    },
    parameters: {},
    locked: false,
  };
}

export function createAnglePlane(
  id: string,
  name: string,
  source: ReferencePlane,
  axisStart: Vec3,
  axisEnd: Vec3,
  angleDeg: number,
  flip: boolean
): ReferencePlane {
  if (!Number.isFinite(angleDeg)) {
    throw new Error("Angle must be finite");
  }
  const axis = toVector(axisEnd).sub(toVector(axisStart));
  if (axis.lengthSq() <= EPS) {
    throw new Error("Axis direction is not valid");
  }

  const angleRad = THREE.MathUtils.degToRad(flip ? -angleDeg : angleDeg);
  const q = new THREE.Quaternion().setFromAxisAngle(axis.normalize(), angleRad);
  const n = toVector(source.normal).applyQuaternion(q);
  const x = toVector(source.x_axis).applyQuaternion(q);
  const y = toVector(source.y_axis).applyQuaternion(q);
  const basis = orthonormalBasis(fromVector(n), fromVector(x), fromVector(y));

  return {
    id,
    name,
    type: "angle",
    part_id: source.part_id,
    origin: source.origin,
    normal: basis.normal,
    x_axis: basis.xAxis,
    y_axis: basis.yAxis,
    visible: true,
    references: {
      plane: { id: source.id, origin: source.origin, normal: source.normal },
      axis_start: axisStart,
      axis_end: axisEnd,
    },
    parameters: { angle: angleDeg, flip },
    locked: false,
  };
}

export function ensureFinitePlane(plane: ReferencePlane) {
  const all = [
    plane.origin.x,
    plane.origin.y,
    plane.origin.z,
    plane.normal.x,
    plane.normal.y,
    plane.normal.z,
    plane.x_axis.x,
    plane.x_axis.y,
    plane.x_axis.z,
    plane.y_axis.x,
    plane.y_axis.y,
    plane.y_axis.z,
  ];
  if (all.some((value) => !Number.isFinite(value))) {
    throw new Error("Plane contains non-finite values");
  }
}

export function planeVisualSizeFromPart(part: { parameters: Record<string, number | string> }) {
  const width = Number(part.parameters.width ?? 100);
  const depth = Number(part.parameters.depth ?? 100);
  const height = Number(part.parameters.height ?? part.parameters.thickness ?? 20);
  return Math.max(width, depth, height) * 1.2;
}
