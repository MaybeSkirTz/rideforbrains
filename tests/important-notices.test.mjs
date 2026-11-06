import { test } from 'node:test';
import assert from 'node:assert/strict';
import { torontoSchedule } from '../shared/important-notices.ts';

test('Operational scheduling uses Toronto regardless of the staff browser and rejects ambiguous clocks', () => {
  const iso = (value) => new Date(torontoSchedule(value) * 1000).toISOString();
  assert.equal(iso('2027-08-21T07:30'), '2027-08-21T11:30:00.000Z');
  assert.equal(iso('2027-01-15T07:30'), '2027-01-15T12:30:00.000Z');
  assert.equal(torontoSchedule('2027-03-14T02:30'), null);
  assert.equal(torontoSchedule('2027-11-07T01:30'), null);
  assert.equal(torontoSchedule('2027-02-30T08:00'), null);
});
