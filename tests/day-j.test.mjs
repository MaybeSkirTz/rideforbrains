import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayJPhase } from '../shared/day-j.ts';

test('Day J switches at Toronto midnight at both ends of the event date', () => {
  const phase = (iso) => dayJPhase('2027-08-21', new Date(iso));
  assert.equal(phase('2027-08-21T03:59:59Z'), 'before');
  assert.equal(phase('2027-08-21T04:00:00Z'), 'today');
  assert.equal(phase('2027-08-22T03:59:59Z'), 'today');
  assert.equal(phase('2027-08-22T04:00:00Z'), 'after');
});
