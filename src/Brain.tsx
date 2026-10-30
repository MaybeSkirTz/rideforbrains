import { useEffect, useRef } from 'react';
import * as T from 'three';
import { buildScene } from './NeuralGeometry';
import type { SceneMode } from './Scene';
export default function Brain({
  mode = 'brain',
  compact = false,
  time = '07:30',
}: {
  mode?: SceneMode;
  compact?: boolean;
  time?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const wrapper = host.parentElement;
    host.dataset.animationState = 'initializing';
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
    } catch {
      return;
    }
    const small = innerWidth < 760 || compact,
      scene = new T.Scene(),
      camera = new T.PerspectiveCamera(34, 1, 0.1, 40);
    camera.position.set(0, 0.15, 7.3);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.25 : 1.6));
    renderer.setClearColor(0, 0);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);
    scene.add(new T.HemisphereLight('#ffffff', '#8b9f8b', 2.3));
    const key = new T.DirectionalLight('#ffffff', 3);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const fill = new T.DirectionalLight('#64bcda', 1.4);
    fill.position.set(3, -1, -3);
    scene.add(fill);
    const { group, animate: updates } = buildScene(mode, small, time);
    scene.add(group);
    let visible = false,
      frame = 0,
      disposed = false,
      p = 0,
      target = 0,
      pointerX = 0,
      pointerY = 0,
      last = 0,
      slow = 0,
      clock = 0;
    const resize = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    const scroll = () => {
      const section = host.closest('[data-neural-story]') || host.parentElement;
      if (!section) return;
      const r = section.getBoundingClientRect();
      target =
        mode === 'brain'
          ? T.MathUtils.smoothstep(-r.top / Math.max(1, r.height - innerHeight * 0.45), 0.05, 0.87)
          : T.MathUtils.clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
    };
    const pointer = (e: PointerEvent) => {
      if (visible && e.pointerType !== 'touch') {
        const r = host.getBoundingClientRect();
        pointerX = T.MathUtils.clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5) * 0.08;
        pointerY = T.MathUtils.clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5) * 0.06;
      }
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      host.dataset.animationState = 'paused';
    };
    const animate = (ms: number) => {
      frame = 0;
      if (disposed || !visible || document.hidden) return;
      const delta = last ? Math.min((ms - last) / 1000, 0.05) : 0;
      last = ms;
      clock += delta;
      if (host.dataset.animationState !== 'rendering') host.dataset.animationState = 'rendering';
      const elapsed = Math.floor(clock).toString();
      if (host.dataset.elapsed !== elapsed) host.dataset.elapsed = elapsed;
      if (delta > 0.035) slow++;
      if (slow === 35) {
        renderer.setPixelRatio(1);
        resize();
        slow++;
      }
      p += (target - p) * 0.04;
      updates.forEach((fn) => fn(clock, p));
      camera.position.x += (pointerX - camera.position.x) * 0.04;
      camera.position.y += (0.15 + pointerY - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      wrapper?.classList.add('scene-ready');
      frame = requestAnimationFrame(animate);
    };
    const start = () => {
      if (visible && !document.hidden && !frame) {
        last = 0;
        frame = requestAnimationFrame(animate);
      }
    };
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        visible ? start() : stop();
      },
      { threshold: 0.015 },
    );
    io.observe(host);
    const visibility = () => (document.hidden ? stop() : start());
    const lost = (e: Event) => {
      e.preventDefault();
      stop();
      wrapper?.classList.remove('scene-ready');
    };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('pointermove', pointer, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    scroll();
    return () => {
      disposed = true;
      stop();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('pointermove', pointer);
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      group.traverse((o) => {
        if (o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Points) {
          o.geometry?.dispose();
          const materials = Array.isArray(o.material) ? o.material : [o.material];
          materials.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      wrapper?.classList.remove('scene-ready');
    };
  }, [mode, compact, time]);
  return <div ref={ref} className="neural-canvas" />;
}
