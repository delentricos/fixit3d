import type { Part } from "./types";

export interface PartTreeNode {
  part: Part;
  children: PartTreeNode[];
}

export function buildPartTree(parts: Part[]): PartTreeNode[] {
  const nodes = new Map<string, PartTreeNode>();

  for (const part of parts) {
    nodes.set(part.id, {
      part,
      children: [],
    });
  }

  const roots: PartTreeNode[] = [];

  for (const part of parts) {
    const node = nodes.get(part.id)!;
    const parentId = part.features.attached_to?.part_id;

    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
