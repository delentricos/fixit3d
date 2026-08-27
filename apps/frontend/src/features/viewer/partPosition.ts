import type {
  Part,
  PartPosition,
  PartRotation,
  PartScale,
} from "../parts/types";

export function getPartPosition(
  part: Part,
  index: number,
  parts: Part[]
): PartPosition {
  const storedPosition = part.position;

  if (
    storedPosition &&
    Number.isFinite(storedPosition.x) &&
    Number.isFinite(storedPosition.y) &&
    Number.isFinite(storedPosition.z)
  ) {
    return {
      x: Number(storedPosition.x ?? 0),
      y: Number(storedPosition.y ?? 0),
      z: Number(storedPosition.z ?? 0),
    };
  }

  const width = Number(part.parameters.width ?? 100);
  const depth = Number(part.parameters.depth ?? 100);
  const height = Number(
    part.parameters.height ??
      part.parameters.thickness ??
      20
  );

  if (!part.features.attached_to) {
    return { x: 0, y: height / 2, z: 0 };
  }

  const parent = parts.find(
    (item) => item.id === part.features.attached_to?.part_id
  );
  const mountPosition = part.features.mount_position;

  if (
    !parent ||
    typeof mountPosition !== "object" ||
    mountPosition === null
  ) {
    return { x: index * 350, y: height / 2, z: 0 };
  }

  return getPositionAtMount(parent, mountPosition, height);
}

export function getPositionAtMount(
  host: Part,
  mountPosition: unknown,
  childHeight: number
): PartPosition {
  const parentWidth = Number(host.parameters.width ?? 0);
  const parentDepth = Number(host.parameters.depth ?? 0);
  const parentHeight = Number(host.parameters.height ?? 0);
  const mount = mountPosition as {
    x?: number;
    y?: number;
    z?: number;
  };

  return {
    x: Number(mount.x ?? 0) - parentWidth / 2,
    y: Number(mount.z ?? parentHeight) + childHeight / 2,
    z: Number(mount.y ?? 0) - parentDepth / 2,
  };
}

export function getMountPosition(
  host: Part,
  mountId: string,
  child: Part,
  hostPosition: PartPosition = { x: 0, y: 0, z: 0 }
): PartPosition | null {
  const mountPoints = host.features.mount_points;

  if (!Array.isArray(mountPoints)) return null;

  const mount = mountPoints.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as { id?: string }).id === mountId
  );

  if (!mount || typeof mount !== "object") return null;

  const mountPosition = (mount as { position?: unknown }).position;
  if (
    !mountPosition ||
    typeof mountPosition !== "object" ||
    Array.isArray(mountPosition)
  ) {
    return null;
  }

  const childHeight = Number(
    child.parameters.height ??
      child.parameters.thickness ??
      20
  );

  const localPosition = getPositionAtMount(
    host,
    mountPosition,
    childHeight
  );

  return {
    x: hostPosition.x + localPosition.x,
    y: hostPosition.y + localPosition.y,
    z: hostPosition.z + localPosition.z,
  };
}

export function getPartRotation(part: Part): PartRotation {
  const storedRotation = part.rotation;

  if (
    storedRotation &&
    Number.isFinite(storedRotation.x) &&
    Number.isFinite(storedRotation.y) &&
    Number.isFinite(storedRotation.z)
  ) {
    return {
      x: storedRotation.x,
      y: storedRotation.y,
      z: storedRotation.z,
    };
  }

  return { x: 0, y: 0, z: 0 };
}

export function getPartScale(part: Part): PartScale {
  const storedScale = part.scale;

  if (
    storedScale &&
    Number.isFinite(storedScale.x) &&
    Number.isFinite(storedScale.y) &&
    Number.isFinite(storedScale.z) &&
    storedScale.x > 0 &&
    storedScale.y > 0 &&
    storedScale.z > 0
  ) {
    return {
      x: storedScale.x,
      y: storedScale.y,
      z: storedScale.z,
    };
  }

  return { x: 1, y: 1, z: 1 };
}
