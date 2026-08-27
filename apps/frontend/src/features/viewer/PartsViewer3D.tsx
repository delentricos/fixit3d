import { useEffect, useRef } from "react";
import * as THREE from "three";

type Part = {
  id: string;
  plugin: string;
  parameters: {
    width?: number;
    depth?: number;
    height?: number;
    thickness?: number;
  };
};

type Props = {
  parts: Part[];
};

function PartsViewer3D({ parts }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f3f5);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      5000
    );

    camera.position.set(500, 400, 600);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);

    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
      0xffffff,
      2
    );

    directionalLight.position.set(300, 500, 400);
    scene.add(directionalLight);

    const grid = new THREE.GridHelper(800, 20);
    scene.add(grid);

    const group = new THREE.Group();
    scene.add(group);

    parts.forEach((part, index) => {
      const width = part.parameters.width ?? 100;
      const depth = part.parameters.depth ?? 100;
      const height =
        part.parameters.height ??
        part.parameters.thickness ??
        20;

      const geometry = new THREE.BoxGeometry(
        width,
        height,
        depth
      );

      const material = new THREE.MeshStandardMaterial({
        color:
          part.plugin === "box"
            ? 0x4f8cff
            : part.plugin === "lid"
              ? 0x55aa66
              : 0xdd8844,
        metalness: 0.15,
        roughness: 0.7,
      });

      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.x = index * 350;
      mesh.position.y = height / 2;

      group.add(mesh);
    });

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);

      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();

          if (Array.isArray(object.material)) {
            object.material.forEach((material) =>
              material.dispose()
            );
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [parts]);

  return (
    <section
      style={{
        marginTop: "2rem",
      }}
    >
      <h2>3D Parts Viewer</h2>

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "500px",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      />
    </section>
  );
}

export default PartsViewer3D;
