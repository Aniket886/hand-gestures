import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import type { SpatialGestureState, SpatialInteractionState, SpatialMode, SpatialObject } from "@/lib/spatialTypes";

interface SpatialSceneProps {
  mode: SpatialMode;
  objects: SpatialObject[];
  interaction: SpatialInteractionState;
  gestures: SpatialGestureState;
  onResetSolar: () => void;
}

function SpatialObjectNode({
  object,
  isSolar,
  sceneScale,
}: {
  object: SpatialObject;
  isSolar: boolean;
  sceneScale: number;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    if (isSolar && object.kind === "planet" && !object.grabbed && object.orbitalRadius && object.orbitalSpeed) {
      ref.current.rotation.y += delta * object.orbitalSpeed * 0.2;
    }
  });

  const scale = [object.scale.x * sceneScale, object.scale.y * sceneScale, object.scale.z * sceneScale] as const;
  const position = [object.position.x, object.position.y, object.position.z] as const;
  const rotation = [object.rotation.x, object.rotation.y, object.rotation.z] as const;
  const emissive = object.grabbed ? "#4cc9f0" : object.selected ? "#90e0ef" : object.hovered ? "#4361ee" : "#111827";

  if (object.kind === "drawing" && object.points?.length) {
    const points = object.points.map((point) => new THREE.Vector3(point.x, point.y, 0));
    return (
      <group ref={ref} position={position} rotation={rotation} scale={scale}>
        <Line points={points} color={object.color} lineWidth={3} />
        <Text position={[0, -0.8, 0]} fontSize={0.18} color="#d1fae5">
          {object.label}
        </Text>
      </group>
    );
  }

  return (
    <group ref={ref} position={position} rotation={rotation} scale={scale}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[object.radius || 0.45, 48, 48]} />
        <meshStandardMaterial color={object.color} emissive={emissive} emissiveIntensity={object.grabbed ? 1.8 : object.selected ? 0.8 : 0.2} metalness={0.25} roughness={0.4} />
      </mesh>
      <Text position={[0, (object.radius || 0.45) + 0.45, 0]} fontSize={0.18} color="#f8fafc">
        {object.label}
      </Text>
    </group>
  );
}

function SceneContent({ mode, objects, interaction }: Pick<SpatialSceneProps, "mode" | "objects" | "interaction">) {
  useFrame((state, delta) => {
    state.camera.position.lerp(
      new THREE.Vector3(0, 1.8, (mode === "solar" ? 14 : 9) / interaction.sceneZoom),
      Math.min(1, delta * 2)
    );
  });

  return (
    <>
      <color attach="background" args={["#070b14"]} />
      <fog attach="fog" args={["#070b14", 10, 26]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 8, 5]} intensity={2} castShadow />
      <pointLight position={[0, 0, 0]} intensity={mode === "solar" ? 22 : 8} color="#f8b400" />
      <Grid args={[30, 30]} cellColor="#1f2937" sectionColor="#0ea5e9" fadeDistance={30} fadeStrength={1} />
      {objects.map((object) => (
        <SpatialObjectNode key={object.id} object={object} isSolar={mode === "solar"} sceneScale={interaction.sceneScale} />
      ))}
      <OrbitControls enablePan enableZoom enableRotate makeDefault />
    </>
  );
}

export function SpatialScene({ mode, objects, interaction, gestures, onResetSolar }: SpatialSceneProps) {
  const sceneLabel = useMemo(() => {
    if (mode === "draw") return "Draw objects in the camera panel, then inspect them here.";
    if (mode === "spatial") return "Pinch to grab, drag to move, use two hands to scale.";
    return "Solar System demo: grab planets, orbit the scene, and inspect in 360 degrees.";
  }, [mode]);

  return (
    <div className="relative h-[620px] w-full rounded-2xl overflow-hidden border border-border bg-[#070b14]">
      <Canvas camera={{ position: [0, 1.8, 9], fov: 48 }} shadows>
        <SceneContent mode={mode} objects={objects} interaction={interaction} />
      </Canvas>
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3 pointer-events-none">
        <div className="bg-card/75 backdrop-blur-xl border border-border rounded-xl px-4 py-3 max-w-[420px]">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Spatial Interaction Mode
          </p>
          <p className="font-mono text-xs text-foreground mt-1">{sceneLabel}</p>
        </div>
        {mode === "solar" && (
          <button
            onClick={onResetSolar}
            className="pointer-events-auto bg-primary/10 border border-primary/30 rounded-xl px-4 py-2 font-mono text-xs text-primary hover:bg-primary/20 transition-all"
          >
            Reset Orbits
          </button>
        )}
      </div>
    </div>
  );
}
