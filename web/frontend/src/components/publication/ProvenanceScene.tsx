import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { ProvenanceGraphData } from "@/types/api";
import { provenanceColours, type Coordinates } from "@/lib/provenance-graph";

export type CameraCommand = { action: "reset" | "focus" | "closer" | "farther" | "rotate" | "pan"; stamp: number; point?: Coordinates };

function CameraRig({ command, contextLost }: { command?: CameraCommand; contextLost: () => void }) {
  const { camera, gl, invalidate } = useThree();
  const controls = useRef<OrbitControls>(null);
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = false;
    orbit.enableZoom = false; // Use the zoom buttons so the wheel still scrolls the publication.
    gl.domElement.style.touchAction = "pan-y";
    orbit.minDistance = 2.5;
    orbit.maxDistance = 24;
    const changed = () => invalidate();
    const lost = (event: Event) => { event.preventDefault(); contextLost(); };
    orbit.addEventListener("change", changed);
    gl.domElement.addEventListener("webglcontextlost", lost);
    controls.current = orbit;
    orbit.update();
    orbit.saveState();
    return () => {
      controls.current = null;
      gl.domElement.removeEventListener("webglcontextlost", lost);
      orbit.removeEventListener("change", changed);
      orbit.dispose();
    };
  }, [camera, gl, invalidate, contextLost]);
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit || !command) return;
    const offset = camera.position.clone().sub(orbit.target);
    if (command.action === "reset") orbit.reset();
    else if (command.action === "focus" && command.point) {
      orbit.target.set(...command.point);
      camera.position.copy(orbit.target).add(offset.setLength(Math.min(offset.length(), 7.5)));
    } else if (command.action === "closer" || command.action === "farther") {
      const distance = Math.min(orbit.maxDistance, Math.max(orbit.minDistance, offset.length() * (command.action === "closer" ? .78 : 1.27)));
      camera.position.copy(orbit.target).add(offset.setLength(distance));
    } else if (command.action === "rotate") {
      camera.position.copy(orbit.target).add(offset.applyAxisAngle(new Vector3(0, 1, 0), Math.PI / 8));
    } else if (command.action === "pan") {
      const movement = new Vector3(.55, 0, 0).applyQuaternion(camera.quaternion);
      orbit.target.add(movement);
      camera.position.add(movement);
    }
    orbit.update();
    invalidate();
  }, [command, camera, invalidate]);
  return null;
}

const initialPosition: Coordinates = [0, 1.5, 12];
export interface SceneProps {
  graph: ProvenanceGraphData;
  positions: Map<string, Coordinates>;
  theme: "light" | "dark";
  selected: string;
  emphasis: Set<string>;
  neighbours: Set<string>;
  command?: CameraCommand;
  select: (id: string) => void;
  contextLost: () => void;
}

export default function ProvenanceScene({ graph, positions, theme, selected, emphasis, neighbours, command, select, contextLost }: SceneProps) {
  const palette = provenanceColours[theme];
  const arrows = useMemo(() => graph.edges.flatMap((edge) => {
    const a = positions.get(edge.source);
    const b = positions.get(edge.target);
    if (!a || !b) return [];
    const start = new Vector3(...a), end = new Vector3(...b);
    const direction = end.clone().sub(start);
    const distance = direction.length();
    const size = emphasis.has(edge.id) ? .22 : .16;
    const colour = emphasis.has(edge.id) ? palette.active : palette.link;
    if (distance < .09) return [{ id: edge.id, loop: true, start, direction: new Vector3(1, 0, 0), length: .24, colour, size }];
    direction.normalize();
    start.addScaledVector(direction, .23);
    return [{ id: edge.id, loop: false, start, direction, length: Math.max(.09, distance - .52), colour, size }];
  }), [graph.edges, positions, emphasis, palette]);
  return <Canvas gl={{ antialias: true, powerPreference: "low-power" }} camera={{ position: initialPosition, fov: 43 }}
    frameloop="demand" dpr={[1, 1.5]} aria-hidden="true" className="pub-provenance-canvas">
    <color attach="background" args={[palette.background]} />
    <ambientLight intensity={1.5} />
    <directionalLight position={[3, 5, 6]} intensity={2.2} />
    <CameraRig command={command} contextLost={contextLost} />
    {arrows.map(({ id, loop, start, direction, length, colour, size }) => loop
      ? <group key={id} position={start}>
          <mesh position={[0, .42, 0]}><torusGeometry args={[.21, .016, 5, 16]} /><meshBasicMaterial color={colour} /></mesh>
          <arrowHelper args={[direction, new Vector3(-.14, .63, 0), length, colour, size * .6, size * .6]} />
        </group>
      : <arrowHelper key={id} args={[direction, start, length, colour, size, size * .72]} />)}
    {graph.nodes.map(({ id, kind }) => {
      const position = positions.get(id);
      if (!position) return null;
      return <group key={id} position={position}>
        <mesh scale={id === selected ? 1.25 : 1}
          onClick={(event) => { event.stopPropagation(); select(id); }}>
          {kind === "process" ? <sphereGeometry args={[.23, 12, 10]} />
            : kind === "artifact" ? <boxGeometry args={[.37, .37, .37]} />
              : kind === "network" ? <octahedronGeometry args={[.29]} />
                : <tetrahedronGeometry args={[.27]} />}
          <meshStandardMaterial color={id === selected ? palette.selected : palette[kind]} roughness={.64} transparent opacity={id === selected || neighbours.has(id) ? 1 : .62} />
        </mesh>
      </group>;
    })}
  </Canvas>;
}
