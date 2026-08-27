import { Grid } from "@react-three/drei";

type Props = {
  grid: string;
};

function GroundGrid({ grid }: Props) {
  const parsedGrid = Number(grid.trim());
  const cellSize = Number.isFinite(parsedGrid) && parsedGrid > 0
    ? parsedGrid
    : 10;

  return (
    <Grid
      args={[1200, 1200]}
      cellSize={cellSize}
      cellThickness={0.45}
      cellColor="#4b5563"
      sectionSize={cellSize * 5}
      sectionThickness={1}
      sectionColor="#7c8796"
      fadeDistance={700}
      fadeStrength={1.2}
      infiniteGrid
      raycast={() => null}
    />
  );
}

export default GroundGrid;
