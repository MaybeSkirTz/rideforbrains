import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScene } from '../src/NeuralGeometry.ts';
test('All sixteen procedural scenes animate without invalid geometry on desktop and mobile', () => {
  const modes = [
    'brain',
    'cortex',
    'synapse',
    'signal',
    'network',
    'velo',
    'pedal',
    'course',
    'stride',
    'marche',
    'steps',
    'impact',
    'team',
    'arrival',
    'preparation',
    'convergence',
  ];
  for (const small of [true, false])
    for (const mode of modes) {
      const { group, animate } = buildScene(mode, small, '07:30');
      assert.ok(group.children.length > 0, mode);
      for (const t of [0, 1, 5]) for (const update of animate) update(t, t / 5);
      group.traverse((object) => {
        if (object.geometry) {
          const position = object.geometry.getAttribute('position');
          assert.ok(position.count > 0, mode);
          assert.ok([...position.array].every(Number.isFinite), mode);
          object.geometry.dispose();
        }
        if (object.material) {
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            material.dispose();
        }
      });
    }
});
