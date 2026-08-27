export interface PartAttachment {
  part_id: string;
  mount_id: string;
}

export interface PartFeatures {
  attached_to?: PartAttachment;
  [key: string]: unknown;
}

export interface PartGeometry {
  type: string;
  [key: string]: unknown;
}

export interface PartPosition {
  x: number;
  y: number;
  z: number;
}

export interface PartRotation {
  x: number;
  y: number;
  z: number;
}

export interface PartScale {
  x: number;
  y: number;
  z: number;
}

export interface Part {
  id: string;
  plugin: string;
  parameters: Record<string, number | string>;
  features: PartFeatures;
  geometry: PartGeometry;
  position?: PartPosition;
  rotation?: PartRotation;
  scale?: PartScale;
}

export interface PartsResponse {
  parts: Part[];
}

export interface CompatibleHost {
  part: Part;
  connection_type: string;
  mount_id: string;
}

export interface CompatibleHostsResponse {
  part_id: string;
  hosts: CompatibleHost[];
}
