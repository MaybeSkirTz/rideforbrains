import * as T from 'three';
import type { SceneMode } from './Scene';
export const colors = ['#249dd3', '#194d43', '#a3b94b'];
export function buildScene(mode: SceneMode, small: boolean, time: string) {
  const group = new T.Group(),
    animate: ((t: number, p: number) => void)[] = [];
  const mat = (color: string, extra: any = {}) =>
    new T.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.08, ...extra });
  const line = (
    points: T.Vector3[],
    color = colors[1],
    opacity = 1,
    parent: T.Object3D = group,
  ) => {
    const obj = new T.Line(
      new T.BufferGeometry().setFromPoints(points),
      new T.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
    );
    parent.add(obj);
    return obj;
  };
  const tube = (points: T.Vector3[], radius: number, color: string, parent: T.Object3D = group) => {
    const curve = new T.CatmullRomCurve3(points);
    const obj = new T.Mesh(
      new T.TubeGeometry(curve, Math.min(128, points.length * 3), radius, small ? 5 : 7, false),
      mat(color),
    );
    parent.add(obj);
    return obj;
  };
  const sphere = (r: number, color: string, parent: T.Object3D = group) => {
    const obj = new T.Mesh(new T.SphereGeometry(r, small ? 12 : 20, small ? 8 : 14), mat(color));
    parent.add(obj);
    return obj;
  };
  const ring = (r: number, color: string, parent: T.Object3D = group) => {
    const obj = new T.Mesh(new T.TorusGeometry(r, 0.024, 6, small ? 48 : 80), mat(color));
    parent.add(obj);
    return obj;
  };
  const points = (f: (t: number) => T.Vector3, n = 70) =>
    Array.from({ length: n }, (_, i) => f(i / (n - 1)));
  const pulse = (pts: T.Vector3[], color = colors[0], offset = 0, r = 0.055) => {
    const curve = new T.CatmullRomCurve3(pts),
      ball = sphere(r, color);
    animate.push((t) => ball.position.copy(curve.getPoint((t * 0.16 + offset) % 1)));
    return ball;
  };
  const road = (y = 0) =>
    points((t) => new T.Vector3((t - 0.5) * 5, y + 0.12 * Math.sin(t * 7), 0.35 * Math.sin(t * 6)));
  const cortical = (theta: number, phi: number, side: number) => {
    const f =
      1 +
      0.045 * Math.sin(theta * 14 + Math.sin(phi * 9) * 1.7) +
      0.027 * Math.cos(phi * 22 + Math.sin(theta * 6) * 2);
    return new T.Vector3(
      side * (0.46 + 0.72 * Math.sin(phi) * Math.cos(theta) * f),
      0.88 * Math.cos(phi) * f + 0.17,
      0.88 * Math.sin(phi) * Math.sin(theta) * f,
    );
  };
  if (mode === 'brain' || mode === 'cortex') {
    const count = small ? 5500 : 14500,
      base = new Float32Array(count * 3),
      pos = new Float32Array(count * 3),
      rgb = new Float32Array(count * 3),
      targets = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = cortical(
          i * 2.399963,
          Math.acos(1 - (2 * ((i % Math.floor(count / 2)) + 0.5)) / Math.floor(count / 2)),
          i % 2 ? 1 : -1,
        ),
        t = i / count,
        c = new T.Color(i % 9 === 0 ? colors[0] : i % 13 === 0 ? colors[2] : colors[1]);
      base.set(p.toArray(), i * 3);
      pos.set(p.toArray(), i * 3);
      rgb.set(c.toArray(), i * 3);
      targets.set(
        [
          (t - 0.5) * 5.1,
          ((i % 3) - 1) * 0.72 + 0.15 * Math.sin(t * 13),
          Math.sin(t * 8 + (i % 3)) * 0.4,
        ],
        i * 3,
      );
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(rgb, 3));
    group.add(
      new T.Points(
        geo,
        new T.PointsMaterial({
          size: small ? 0.019 : 0.015,
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
        }),
      ),
    );
    const cortex = new T.Group();
    group.add(cortex);
    const pulses: T.Object3D[] = [];
    for (const side of [-1, 1]) {
      const surface = new T.SphereGeometry(1, small ? 52 : 80, small ? 38 : 64),
        a = surface.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const p = cortical(
          Math.atan2(a.getZ(i), a.getX(i)),
          Math.acos(Math.max(-1, Math.min(1, a.getY(i)))),
          side,
        );
        a.setXYZ(i, p.x, p.y, p.z);
      }
      surface.computeVertexNormals();
      cortex.add(
        new T.Mesh(
          surface,
          mat('#7da898', { transparent: true, opacity: 0.32, depthWrite: false }),
        ),
      );
      for (let j = 0; j < 14; j++) {
        const pts = points((t) =>
          cortical(
            (j / 14) * Math.PI * 2 + 0.14 * Math.sin((0.24 + t * 2.48) * 7 + j * 0.9),
            0.24 + t * 2.48,
            side,
          ).multiplyScalar(1.008),
        );
        line(pts, j % 4 === 0 ? colors[0] : colors[1], 0.5, cortex);
        if (j % 4 === 0) pulses.push(pulse(pts, j % 2 ? colors[2] : colors[0], j * 0.13, 0.032));
      }
      const lobe = sphere(0.34, '#729987', cortex);
      lobe.scale.set(1, 0.62, 0.9);
      lobe.position.set(side * 0.3, -0.96, -0.43);
      for (let j = 0; j < 5; j++) {
        const r = ring(0.25 - j * 0.018, colors[1], cortex);
        r.scale.y = 0.5;
        r.position.set(side * 0.3, -0.96 + j * 0.035, -0.42);
      }
    }
    tube(
      [
        new T.Vector3(0, -0.65, -0.38),
        new T.Vector3(0, -1.2, -0.3),
        new T.Vector3(0.05, -1.37, -0.1),
      ],
      0.09,
      '#719984',
      cortex,
    );
    group.rotation.set(0.13, -0.45, -0.08);
    animate.push((t, p) => {
      const f = mode === 'brain' ? p : 0;
      for (let i = 0; i < pos.length; i++) pos[i] = base[i] + (targets[i] - base[i]) * f;
      geo.attributes.position.needsUpdate = true;
      cortex.visible = f < 0.95;
      cortex.scale.setScalar(1 - f * 0.45);
      cortex.traverse((o) => {
        if (o instanceof T.Mesh || o instanceof T.Line) {
          const m = o.material as T.Material & { opacity: number };
          m.opacity =
            (o instanceof T.Mesh && o.geometry.type === 'SphereGeometry' ? 0.32 : 1) * (1 - f);
          m.transparent = true;
        }
      });
      pulses.forEach((b) => (b.visible = f < 0.3));
      group.rotation.y = -0.45 + f * 0.45 + Math.sin(t * 0.22) * 0.018;
    });
  } else if (mode === 'synapse') {
    for (const side of [-1, 1]) {
      const n = new T.Group();
      n.position.x = side * 1.2;
      group.add(n);
      const core = sphere(0.17, colors[1], n);
      for (let j = 0; j < 7; j++) {
        const a = (j / 7) * Math.PI * 2,
          end = new T.Vector3(Math.cos(a) * 0.72, Math.sin(a) * 0.72, Math.sin(j) * 0.12);
        tube(
          [
            end.clone().multiplyScalar(0.15),
            end
              .clone()
              .multiplyScalar(0.6)
              .add(new T.Vector3(0.05, 0, 0.08)),
            end,
          ],
          0.018,
          colors[1],
          n,
        );
        for (const s of [-1, 1])
          line(
            [
              end.clone().multiplyScalar(0.72),
              end.clone().add(new T.Vector3(-Math.sin(a) * s * 0.19, Math.cos(a) * s * 0.19, 0.04)),
            ],
            colors[1],
            0.7,
            n,
          );
      }
      animate.push((t) => core.scale.setScalar(1 + Math.sin(t * 1.3 + side) * 0.05));
    }
    const bridge = points((t) => new T.Vector3(-0.6 + t * 1.2, 0.12 * Math.sin(t * 7), 0.1));
    line(bridge, colors[0], 0.6);
    for (let i = 0; i < 6; i++) pulse(bridge, colors[i % 3], i / 6, 0.04);
  } else if (mode === 'signal') {
    group.rotation.y = -0.25;
    for (let j = 0; j < 5; j++) {
      const fiber = points(
        (t) =>
          new T.Vector3(
            (t - 0.5) * 4.8,
            Math.sin(t * 8 + j * 0.7) * 0.22 + (j - 2) * 0.3,
            Math.cos(t * 8 + j * 0.7) * 0.25,
          ),
      );
      tube(fiber, 0.018, colors[j % 2]);
      pulse(fiber, colors[j % 3], j * 0.17, 0.07);
    }
  } else if (['network', 'impact', 'team'].includes(mode)) {
    const count = mode === 'team' ? 3 : mode === 'impact' ? 32 : 14,
      nodes = Array.from({ length: count }, (_, i) => {
        const a = i * 2.39996,
          r = mode === 'team' ? 1.15 : 0.35 + Math.sqrt(i / count) * 1.8;
        return new T.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.7, Math.sin(i * 1.7) * 0.6);
      });
    for (let i = 0; i < count; i++) {
      sphere(mode === 'team' ? 0.2 : 0.06, colors[i % 3]).position.copy(nodes[i]);
      for (let j = i + 1; j < count; j++) {
        if (nodes[i].distanceTo(nodes[j]) > (mode === 'team' ? 4 : 1.15)) continue;
        const pts = [
            nodes[i],
            nodes[i]
              .clone()
              .lerp(nodes[j], 0.5)
              .add(new T.Vector3(0, 0, 0.15)),
            nodes[j],
          ],
          l = line(pts, colors[1], 0.23);
        if ((i + j) % 4 === 0 || mode === 'team')
          pulse(pts, colors[(i + j) % 3], (i + j) * 0.13, 0.04);
        animate.push((t, p) => {
          l.visible = mode !== 'impact' || (i + j) / count < 0.7 + p + Math.sin(t * 0.2) * 0.07;
        });
      }
    }
    group.rotation.y = -0.3;
  } else if (mode === 'velo' || mode === 'pedal') {
    const bike = new T.Group();
    group.add(bike);
    const wheels: T.Group[] = [];
    for (const x of [-1.03, 1.03]) {
      const w = new T.Group();
      w.position.set(x, -0.25, 0);
      bike.add(w);
      ring(0.67, colors[1], w);
      ring(0.61, '#91aa9a', w);
      for (let j = 0; j < 12; j++) {
        const a = (j / 12) * Math.PI * 2;
        line(
          [new T.Vector3(), new T.Vector3(Math.cos(a) * 0.61, Math.sin(a) * 0.61, 0)],
          colors[1],
          0.35,
          w,
        );
      }
      sphere(0.06, colors[0], w);
      wheels.push(w);
    }
    const A = new T.Vector3(-1.03, -0.25, 0),
      B = new T.Vector3(-0.14, -0.24, 0),
      C = new T.Vector3(-0.45, 0.72, 0),
      D = new T.Vector3(0.73, 0.72, 0),
      E = new T.Vector3(1.03, -0.25, 0);
    for (const pair of [
      [A, B],
      [A, C],
      [C, B],
      [C, D],
      [D, B],
      [D, E],
    ])
      tube(pair, 0.035, colors[0], bike);
    tube([C, new T.Vector3(-0.52, 0.96, 0)], 0.028, colors[1], bike);
    tube([new T.Vector3(-0.8, 0.96, 0), new T.Vector3(-0.28, 0.96, 0)], 0.065, colors[1], bike);
    tube(
      [D, new T.Vector3(0.64, 1.02, 0), new T.Vector3(0.95, 1.06, 0), new T.Vector3(1.08, 0.93, 0)],
      0.027,
      colors[1],
      bike,
    );
    const crank = new T.Group();
    crank.position.copy(B);
    bike.add(crank);
    ring(0.15, colors[1], crank);
    tube([new T.Vector3(-0.27, 0, 0.03), new T.Vector3(0.27, 0, 0.03)], 0.03, colors[1], crank);
    for (const x of [-0.27, 0.27])
      tube(
        [new T.Vector3(x - 0.09, 0, 0.1), new T.Vector3(x + 0.09, 0, 0.1)],
        0.05,
        colors[2],
        crank,
      );
    line(
      [
        new T.Vector3(-1.02, -0.18, 0.03),
        new T.Vector3(-0.16, -0.1, 0.03),
        new T.Vector3(-0.1, -0.37, 0.03),
        new T.Vector3(-1.02, -0.32, 0.03),
        new T.Vector3(-1.02, -0.18, 0.03),
      ],
      colors[1],
      0.6,
      bike,
    );
    bike.rotation.set(0.08, -0.28, 0);
    if (mode === 'pedal') {
      bike.scale.setScalar(1.4);
      bike.position.x = 0.2;
    } else {
      const ground = road(-1.02);
      line(ground, colors[1], 0.2);
      for (let i = 0; i < 6; i++) pulse(ground, colors[2], i / 6, 0.027);
    }
    animate.push((t) => {
      wheels.forEach((w) => (w.rotation.z = -t * 0.55));
      crank.rotation.z = -t * 1.05;
      bike.position.y = Math.sin(t * 0.8) * 0.016;
    });
  } else if (mode === 'course' || mode === 'stride') {
    const runner = new T.Group();
    group.add(runner);
    sphere(0.19, colors[1], runner).position.set(0.15, 1.1, 0);
    tube(
      [new T.Vector3(0.02, 0.1, 0), new T.Vector3(0.03, 0.56, 0), new T.Vector3(0.12, 0.87, 0)],
      0.11,
      colors[0],
      runner,
    );
    const limbs: T.Line[] = [];
    for (let i = 0; i < 4; i++)
      limbs.push(
        line([new T.Vector3(), new T.Vector3(), new T.Vector3()], colors[i < 2 ? 1 : 0], 1, runner),
      );
    line(road(-1.12), colors[1], 0.25);
    for (let j = 0; j < 7; j++) {
      const dot = sphere(0.04, colors[j % 3]);
      animate.push((t) => {
        const f = (t * 0.22 + j / 7) % 1;
        dot.position.set((f - 0.5) * 4.7, -1.1, 0.1);
        dot.scale.setScalar(Math.sin(f * Math.PI));
      });
    }
    runner.rotation.y = -0.3;
    animate.push((t) => {
      const phase = t * 2.7;
      runner.position.y = Math.abs(Math.sin(phase)) * 0.09;
      for (let i = 0; i < 4; i++) {
        const a = Math.sin(phase + (i % 2) * Math.PI),
          hip = new T.Vector3(i < 2 ? 0 : 0.04, i < 2 ? 0.1 : 0.69, i % 2 ? 0.1 : -0.1),
          joint = new T.Vector3(
            hip.x + a * (i < 2 ? 0.48 : 0.35),
            hip.y - (i < 2 ? 0.48 : 0.35),
            hip.z,
          ),
          end = new T.Vector3(
            hip.x - a * (i < 2 ? 0.55 : 0.2),
            i < 2 ? -1.03 : hip.y - 0.17,
            hip.z,
          );
        limbs[i].geometry.setFromPoints([hip, joint, end]);
      }
    });
    if (mode === 'stride') runner.scale.setScalar(1.2);
  } else if (mode === 'marche' || mode === 'steps') {
    group.rotation.set(-0.72, 0.05, -0.12);
    line(road(), colors[1], 0.2);
    for (let i = 0; i < 12; i++) {
      const foot = new T.Group(),
        side = i % 2 ? 1 : -1;
      group.add(foot);
      const sole = sphere(0.12, colors[i % 2], foot);
      sole.scale.set(0.65, 1.5, 0.28);
      for (let j = 0; j < 4; j++)
        sphere(0.03, colors[i % 2], foot).position.set(
          (j - 1.5) * 0.045,
          0.21 - Math.abs(j - 1) * 0.015,
          0,
        );
      foot.position.set((i / 11 - 0.5) * 4.3, 0.15 * Math.sin((i / 11) * 7) + side * 0.27, 0);
      foot.rotation.z = -Math.PI / 2 + 0.14 * Math.sin(i);
      animate.push((t) =>
        foot.scale.setScalar(Math.max(0.18, 1 - Math.abs(((t * 0.85) % 6) - i * 0.5) * 0.6)),
      );
    }
  } else if (mode === 'arrival') {
    ring(1.25, colors[1]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      line(
        [
          new T.Vector3(Math.sin(a) * 1.06, Math.cos(a) * 1.06, 0),
          new T.Vector3(Math.sin(a) * 1.15, Math.cos(a) * 1.15, 0),
        ],
        colors[1],
      );
    }
    const [h, m] = time.split(':').map(Number),
      hand = (a: number, len: number, color: string) =>
        tube(
          [new T.Vector3(0, 0, 0.05), new T.Vector3(Math.sin(a) * len, Math.cos(a) * len, 0.05)],
          0.035,
          color,
        );
    hand((((h % 12) + m / 60) / 12) * Math.PI * 2, 0.65, colors[1]);
    hand((m / 60) * Math.PI * 2, 0.96, colors[0]);
    sphere(0.08, colors[2]);
    const trail = points((t) => new T.Vector3(-2.5 + t * 1.05, -0.5 + 0.5 * t, 0));
    line(trail, colors[1], 0.5);
    pulse(trail, colors[2]);
    group.rotation.y = -0.3;
  } else if (mode === 'convergence') {
    for (let i = 0; i < 3; i++) {
      const curve = points(
        (t) =>
          new T.Vector3(
            (t - 0.5) * 4.7,
            (i - 1) * 1.1 * (1 - t) + Math.sin(t * 8) * 0.12,
            Math.sin(t * 5 + i) * (1 - t) * 0.5,
          ),
      );
      tube(curve, 0.025, colors[i]);
      for (let j = 0; j < 4; j++) pulse(curve, colors[i], j / 4);
    }
    sphere(0.13, colors[2]).position.set(2.38, 0.12 * Math.sin(8), 0);
  } else if (mode === 'preparation') {
    const bottle = new T.Group();
    group.add(bottle);
    bottle.add(new T.Mesh(new T.CylinderGeometry(0.28, 0.3, 1.1, 20), mat('#90ad87')));
    const cap = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.15, 16), mat(colors[1]));
    cap.position.y = 0.64;
    bottle.add(cap);
    ring(0.29, colors[0], bottle).rotation.x = Math.PI / 2;
    bottle.position.x = -1.15;
    const helmet = new T.Mesh(
      new T.SphereGeometry(0.65, 30, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(colors[0], { side: T.DoubleSide }),
    );
    helmet.position.set(0.8, 0, 0);
    group.add(helmet);
    tube(
      [new T.Vector3(0.2, 0, 0), new T.Vector3(0.8, -0.6, 0), new T.Vector3(1.4, 0, 0)],
      0.025,
      colors[1],
    );
    group.rotation.set(0.12, -0.3, 0);
    animate.push((t) => {
      bottle.position.y = Math.sin(t * 0.65) * 0.025;
      helmet.position.y = Math.sin(t * 0.65 + 0.7) * 0.025;
    });
  }
  return { group, animate };
}
