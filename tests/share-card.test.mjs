import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardFormats, shareCardText } from '../shared/share-card.ts';

test('Share cards offer the three sizes and omit names by default and all ticket data in every mode', () => {
  assert.deepEqual(
    Object.values(cardFormats).map(({ width, height }) => [width, height]),
    [
      [1080, 1920],
      [1080, 1080],
      [1200, 630],
    ],
  );
  const entry = {
    firstName: 'Camille',
    lastInitial: 'T',
    activity: 'Course',
    distance: '5 km',
    ticket: 'secret-qr',
    email: 'private@example.test',
    orderId: 'private-order',
  };
  const card = (mode) => shareCardText(entry, '2027-08-21T07:30:00-04:00', mode);
  assert.equal(card('private').name, '');
  assert.equal(card('first').name, 'Camille');
  assert.equal(card('initial').name, 'Camille T.');
  for (const mode of ['private', 'first', 'initial']) {
    assert.deepEqual(Object.keys(card(mode)), ['name', 'activity', 'date']);
    assert.doesNotMatch(JSON.stringify(card(mode)), /secret-qr|example.test|private-order/);
  }
});
