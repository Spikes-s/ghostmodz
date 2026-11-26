import { useEffect, useRef } from "react";
import * as THREE from "three";

function tokenColor(value: string, fallback: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return new THREE.Color(fallback);
  context.fillStyle = fallback;
  context.fillStyle = value.trim() || fallback;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255);
}

function circuitSegments(seed: number) {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const positions: number[] = [];
  for (let layer = 0; layer < 5; layer += 1) {
    const z = 2 - layer * 1.45;
    for (let row = 0; row < 10; row += 1) {
      const y = (row - 4.5) * 0.92;
      let x = -8.5 + random() * 1.6;
      for (let step = 0; step < 5; step += 1) {
        const nextX = Math.min(8.5, x + 1.5 + random() * 1.2);
        const bendY = y + (random() > 0.5 ? 1 : -1) * (0.25 + random() * 0.55);
        const points: number[][] = [[x, y, z], [x + 0.25, y, z], [x + 0.25, bendY, z], [nextX - 0.2, bendY, z], [nextX - 0.2, y, z], [nextX, y, z]];
        for (let i = 0; i < points.length - 1; i += 1) {
          positions.push(...points[i], ...points[i + 1]);
        }
        x = nextX;
      }
    }
  }
  return positions;
}

export function CircuitScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse), (max-width: 768px)");
    if (reducedMotion.matches || !host.clientWidth || !host.clientHeight) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse.matches ? 1 : 1.25));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 80);
    camera.position.set(0, 0.3, 23);
    const themeNode = host.closest("[class*='theme-']") ?? document.documentElement;
    const style = getComputedStyle(themeNode);
    const primary = tokenColor(style.getPropertyValue("--ambience-a"), "oklch(0.68 0.28 305)");
    const secondary = tokenColor(style.getPropertyValue("--ambience-b"), "oklch(0.7 0.22 240)");
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(circuitSegments(43019), 3));
    const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: primary, transparent: true, opacity: 0.45 }));
    scene.add(lines);

    const nodePositions: number[] = [];
    for (let layer = 0; layer < 5; layer += 1) {
      for (let row = 0; row < 10; row += 1) {
        for (let column = 0; column < 13; column += 1) {
          if ((row + column * 3 + layer) % 4 !== 0) continue;
          nodePositions.push((column - 6) * 1.32, (row - 4.5) * 0.92, 2 - layer * 1.45);
        }
      }
    }
    const nodesGeometry = new THREE.BufferGeometry();
    nodesGeometry.setAttribute("position", new THREE.Float32BufferAttribute(nodePositions, 3));
    const nodes = new THREE.Points(nodesGeometry, new THREE.PointsMaterial({ color: secondary, size: 0.075, transparent: true, opacity: 0.58, sizeAttenuation: true }));
    scene.add(nodes);

    let frame = 0;
    let lastDraw = 0;
    let stopped = false;
    let visible = !document.hidden;
    const render = (now: number) => {
      if (stopped || !visible) return;
      frame = requestAnimationFrame(render);
      if (now - lastDraw < (coarse.matches ? 66 : 40)) return;
      lastDraw = now;
      const time = now * 0.00012;
      lines.rotation.y = Math.sin(time) * 0.045;
      lines.rotation.x = 0.025 + Math.sin(time * 0.7) * 0.018;
      nodes.rotation.copy(lines.rotation);
      camera.position.x = Math.sin(time * 0.55) * 0.28;
      camera.lookAt(0, 0, -1);
      renderer.render(scene, camera);
    };
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) frame = requestAnimationFrame(render);
      else cancelAnimationFrame(frame);
    };
    const resize = new ResizeObserver(() => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resize.observe(host);
    document.addEventListener("visibilitychange", onVisibility);
    frame = requestAnimationFrame(render);

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      geometry.dispose();
      nodesGeometry.dispose();
      lines.material.dispose();
      nodes.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="absolute inset-0 opacity-25 mix-blend-screen" aria-hidden="true" />;
}