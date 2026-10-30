import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Brain() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current!;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !window.WebGLRenderingContext)
      return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: devicePixelRatio < 2,
        powerPreference: 'low-power',
      });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    host.appendChild(renderer.domElement);
    host.parentElement?.classList.add('brain-ready');
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.1, 7);
    const brain = new THREE.Group();
    scene.add(brain);
    const points: number[] = [],
      colors: number[] = [],
      links: number[] = [];
    const blue = new THREE.Color('#249cec'),
      lime = new THREE.Color('#bded47');
    // Two lobes with a central fissure and folded surfaces. Each curve traces a neural pathway.
    for (const side of [-1, 1])
      for (let ring = 0; ring < 29; ring++) {
        const v = 0.11 + (ring / 28) * (Math.PI - 0.22);
        let prev: THREE.Vector3 | null = null;
        for (let j = 0; j < 90; j++) {
          const u = (j / 89) * Math.PI * 2;
          const fold =
            1 + 0.065 * Math.sin(9 * u + 3 * Math.sin(v * 4)) + 0.04 * Math.cos(v * 17 + u * 3);
          const x = side * (0.08 + 0.96 * Math.sin(v) * (1 + Math.cos(u)) * 0.5) * fold;
          const y = Math.cos(v) * 1.2 * fold;
          const z = Math.sin(v) * Math.sin(u) * 0.9 * fold;
          const p = new THREE.Vector3(x, y, z);
          points.push(x, y, z);
          const color = side < 0 ? blue : lime;
          colors.push(color.r, color.g, color.b);
          if (prev && j % 2 === 0) links.push(prev.x, prev.y, prev.z, x, y, z);
          prev = p;
        }
      }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    pg.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const pm = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });
    brain.add(new THREE.Points(pg, pm));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(links, 3));
    const lm = new THREE.LineBasicMaterial({ color: '#5db2a8', transparent: true, opacity: 0.15 });
    brain.add(new THREE.LineSegments(lg, lm));
    brain.rotation.set(0.07, -0.35, -0.1);
    const resize = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(host);
    let frame = 0,
      visible = true,
      active = true;
    const observer = new IntersectionObserver((e) => {
      visible = e[0].isIntersecting;
    });
    observer.observe(host);
    const animate = (t: number) => {
      if (!active) return;
      frame = requestAnimationFrame(animate);
      if (!visible || document.hidden) return;
      brain.rotation.y = -0.35 + Math.sin(t * 0.00016) * 0.32;
      brain.position.y = Math.sin(t * 0.0005) * 0.045;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      obs.disconnect();
      observer.disconnect();
      pg.dispose();
      pm.dispose();
      lg.dispose();
      lm.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      host.parentElement?.classList.remove('brain-ready');
    };
  }, []);
  return <div className="brain-canvas" ref={ref} aria-hidden="true" />;
}
