import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import type { SpatialGestureState, SpatialMode, SpatialObject, Vec3Like } from "@/lib/spatialTypes";

interface SpatialSceneProps {
  mode: SpatialMode;
  objects: SpatialObject[];
  gestures: SpatialGestureState;
  onObjectsChange: (objects: SpatialObject[]) => void;
  onResetSolar: () => void;
}

function lerpVec3(current: Vec3Like, target: Vec3Like, alpha: number): Vec3Like {
  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
    z: current.z + (target.z - current.z) * alpha,
  };
}

function SpatialObjectNode({
  object,
  isSolar,
}: {
  object: SpatialObject;
  isSolar: boolean;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    if (isSolar && object.kind === "planet" && !object.grabbed && object.orbitalRadius && object.orbitalSpeed) {
      ref.current.rotation.y += delta * object.orbitalSpeed * 0.2;
    }
  });

  const scale = [object.scale.x, object.scale.y, object.scale.z] as const;
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

function SceneContent({ mode, objects, gestures, onObjectsChange }: Omit<SpatialSceneProps, "onResetSolar">) {
  const pinchScaleStartRef = useRef<number | null>(null);
  const grabbedObjectRef = useRef<string | null>(null);

  useFrame((state, delta) => {
    const pointer = gestures.primaryPoint;
    const secondaryPointer = gestures.secondaryPoint;

    onObjectsChange(
      objects.map((object) => {
        const next = { ...object };
        const target = new THREE.Vector3(object.position.x, object.position.y, object.position.z);
        const objectPos = new THREE.Vector3(object.position.x, object.position.y, object.position.z);
        const hoverDistance = pointer
          ? objectPos.distanceTo(new THREE.Vector3(pointer.x, pointer.y, pointer.z))
          : Number.POSITIVE_INFINITY;

        next.hovered = hoverDistance < (object.radius || 0.8) * 1.65;

        if (gestures.primaryPinch && next.hovered && !grabbedObjectRef.current) {
          grabbedObjectRef.current = object.id;
        }

        next.selected = grabbedObjectRef.current === object.id;
        next.grabbed = grabbedObjectRef.current === object.id && gestures.primaryPinch;

        if (next.grabbed && pointer) {
          target.set(pointer.x, pointer.y, pointer.z);
          next.position = lerpVec3(next.position, { x: target.x, y: target.y, z: target.z }, Math.min(1, delta * 10));
          next.rotation = {
            x: next.rotation.x + ((pointer.y * 0.06) - next.rotation.x) * Math.min(1, delta * 6),
            y: next.rotation.y + ((pointer.x * 0.12) - next.rotation.y) * Math.min(1, delta * 6),
            z: next.rotation.z,
          };
        }

        if (next.selected && gestures.primaryPinch && gestures.secondaryPinch && gestures.pinchDistance) {
          if (!pinchScaleStartRef.current) pinchScaleStartRef.current = gestures.pinchDistance;
          const ratio = gestures.pinchDistance / pinchScaleStartRef.current;
          const damped = THREE.MathUtils.clamp(ratio, 0.5, 2.4);
          next.scale = {
            x: THREE.MathUtils.clamp(next.scale.x * damped, 0.18, 3.5),
            y: THREE.MathUtils.clamp(next.scale.y * damped, 0.18, 3.5),
            z: THREE.MathUtils.clamp(next.scale.z * damped, 0.18, 3.5),
          };
          pinchScaleStartRef.current = gestures.pinchDistance;
        } else if (!gestures.secondaryPinch) {
          pinchScaleStartRef.current = null;
        }

        return next;
      })
    );

    if (!gestures.primaryPinch) {
      grabbedObjectRef.current = null;
    }

    state.camera.position.lerp(new THREE.Vector3(0, 1.8, mode === "solar" ? 14 : 9), Math.min(1, delta * 2));
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
        <SpatialObjectNode key={object.id} object={object} isSolar={mode === "solar"} />
      ))}
      <OrbitControls enablePan enableZoom enableRotate makeDefault />
    </>
  );
}

export function SpatialScene({ mode, objects, gestures, onObjectsChange, onResetSolar }: SpatialSceneProps) {
  const [sceneObjects, setSceneObjects] = useState(objects);

  useEffect(() => {
    setSceneObjects(objects);
  }, [objects]);

  useEffect(() => {
    onObjectsChange(sceneObjects);
  }, [onObjectsChange, sceneObjects]);

  const sceneLabel = useMemo(() => {
    if (mode === "draw") return "Draw objects in the camera panel, then inspect them here.";
    if (mode === "spatial") return "Pinch to grab, drag to move, use two hands to scale.";
    return "Solar System demo: grab planets, orbit the scene, and inspect in 360 degrees.";
  }, [mode]);

  return (
    <div className="relative h-[620px] w-full rounded-2xl overflow-hidden border border-border bg-[#070b14]">
      <Canvas camera={{ position: [0, 1.8, 9], fov: 48 }} shadows>
        <SceneContent mode={mode} objects={sceneObjects} gestures={gestures} onObjectsChange={setSceneObjects} />
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
