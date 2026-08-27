import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useSelectionStore } from "../../../shared/state/selectionStore";

type Props = {
  partsGroupRef: React.RefObject<THREE.Group | null>;
};

function ViewportToolbar({ partsGroupRef }: Props) {
  const { camera } = useThree();

  const selectedPartId = useSelectionStore(
    (state) => state.selectedPartId
  );

  function fitView() {
    const group = partsGroupRef.current;

    if (!group) return;

    const box = new THREE.Box3().setFromObject(group);

    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxSize = Math.max(
      size.x,
      size.y,
      size.z
    );

    const distance = Math.max(maxSize * 1.8, 400);

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
  }

  function resetView() {
    camera.position.set(600, 450, 700);
    camera.lookAt(0, 100, 0);
  }

  return (
    <group>
      {/* Toolbar is rendered by the HTML overlay in Viewport3D */}
    </group>
  );
}

export default ViewportToolbar;
