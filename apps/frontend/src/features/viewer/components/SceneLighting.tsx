function SceneLighting() {
  return (
    <>
      <ambientLight intensity={1.8} />

      <directionalLight
        position={[400, 600, 300]}
        intensity={2.2}
      />

      <directionalLight
        position={[-300, 250, -200]}
        intensity={0.7}
      />
    </>
  );
}

export default SceneLighting;
