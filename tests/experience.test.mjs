import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pollConfirmation } from '../shared/checkout.ts';
import { activityPriceLabel, participantComplete } from '../shared/registration.ts';
import { launchIssues } from '../shared/launch.ts';
import { storedMotionOff, setMotionOff } from '../shared/motion.ts';

test('Published variable prices, including a free walk, are displayed without resetting them', () => {
  const rows = [3000, 2000, 1500, 1000, 0].map((price) => ({ price }));
  assert.match(activityPriceLabel(rows), /Gratuit à 30/);
  assert.match(activityPriceLabel(rows.slice(1, 4)), /Dès 10/);
  assert.equal(activityPriceLabel([rows[4]]), 'Gratuit');
  assert.equal(activityPriceLabel([]), '');
  assert.deepEqual(
    rows.map((r) => r.price),
    [3000, 2000, 1500, 1000, 0],
  );
});
test('Participant completion respects conditional fields and separate parental approval', () => {
  const activity = {
    sport: 'course',
    fields: [
      { id: 'experience', type: 'select', options: ['Première course'], required: true },
      {
        id: 'detail',
        type: 'text',
        required: true,
        showWhen: { field: 'experience', equals: 'Autre' },
      },
    ],
  };
  const p = {
    firstName: 'Alice',
    lastName: 'Test',
    email: 'alice@example.test',
    phone: '4185550100',
    emergencyName: 'Alex',
    emergencyPhone: '4185550199',
    adult: true,
    conditions: true,
    authority: true,
    answers: { experience: 'Première course' },
  };
  assert.equal(participantComplete(p, activity), true);
  assert.equal(participantComplete({ ...p, conditions: false }, activity), false);
  assert.equal(participantComplete({ ...p, adult: false }, activity), false);
  assert.equal(
    participantComplete({ ...p, adult: false, guardianStatus: 'approved' }, activity),
    true,
  );
  assert.equal(
    participantComplete(
      { ...p, adult: false, guardianStatus: 'approved' },
      { ...activity, sport: 'velo' },
    ),
    false,
  );
  assert.equal(participantComplete({ ...p, answers: { experience: 'Inventée' } }, activity), false);
});
test('Checkout polling waits for server payment proof, tolerates errors and has a bounded fallback', async () => {
  const updates = [],
    controller = new AbortController();
  let reads = 0,
    pauses = 0;
  const result = await pollConfirmation({
    signal: controller.signal,
    onUpdate: (s) => updates.push(s),
    pause: async (ms) => {
      assert.equal(ms, 2500);
      pauses++;
    },
    read: async () => {
      reads++;
      if (reads === 1) throw Error('Fixture offline');
      return { status: 'confirmed', paid: reads > 2 };
    },
  });
  assert.equal(result, 'confirmed');
  assert.equal(reads, 3);
  assert.equal(pauses, 2);
  assert.deepEqual(updates, ['checking', 'confirmed']);
  reads = 0;
  assert.equal(
    await pollConfirmation({
      signal: controller.signal,
      onUpdate: () => {},
      pause: async () => {},
      read: async () => {
        reads++;
        return { status: 'pending', paid: false };
      },
    }),
    'waiting',
  );
  assert.equal(reads, 12);
  controller.abort();
  assert.equal(
    await pollConfirmation({
      signal: controller.signal,
      onUpdate: () => assert.fail('No update after unmount'),
      read: async () => assert.fail('No request after abort'),
    }),
    'waiting',
  );
});
test('Live readiness requires explicit decisions and final texts, without changing historic terms or tariffs', () => {
  const s = {
    location: 'Lieu fourni',
    legalApproved: true,
    brandApproved: true,
    taxMode: 'not_applicable',
    terms: 'Conditions finalisées',
    privacy: 'Politique finalisée',
    launchReview: {
      refundApproved: true,
      taxApproved: true,
      eventApproved: true,
      cancellation: 'Conditions fournies',
      postponement: 'Conditions fournies',
      weather: 'Conditions fournies',
      forceMajeure: 'Conditions fournies',
    },
  };
  assert.deepEqual(launchIssues(s), []);
  assert.ok(launchIssues({ ...s, launchReview: undefined }).includes('politique de remboursement'));
  assert.ok(launchIssues({ ...s, terms: 'Brouillon à valider' }).includes('textes non finalisés'));
  assert.ok(
    launchIssues({ ...s, launchReview: { ...s.launchReview, weather: '' } }).includes(
      'annulation, report et météo',
    ),
  );
});
test('Blocked browser storage defaults to reduced motion and still remembers a choice within the tab', () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
    win = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let events = 0;
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw Error('Storage blocked');
      },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { dispatchEvent: () => events++ },
    });
    assert.equal(storedMotionOff(), true);
    setMotionOff(false);
    assert.equal(storedMotionOff(), false);
    setMotionOff(true);
    assert.equal(storedMotionOff(), true);
    assert.equal(events, 2);
  } finally {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
    if (win) Object.defineProperty(globalThis, 'window', win);
    else delete globalThis.window;
  }
});
