import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnUrl, accountUrl } from '../shared/navigation.ts';
import { daysUntil, calendarICS, googleCalendarUrl } from '../shared/event.ts';
import { published, editorial } from '../shared/editorial.ts';
test('Return destinations preserve activity and reject external, escaped and API paths', () => {
  assert.equal(safeReturnUrl('/inscription?activite=course-10'), '/inscription?activite=course-10');
  assert.equal(safeReturnUrl('/attente?activite=velo-100'), '/attente?activite=velo-100');
  for (const value of [
    '//evil.test',
    'https://evil.test',
    '/\\evil.test',
    '/api/admin/export',
    '/inscription\nfoo',
    '/other',
  ])
    assert.equal(safeReturnUrl(value), '/espace');
  assert.match(accountUrl('/inscription?activite=course-10', 'create'), /activite%3Dcourse-10/);
});
test('Countdown uses Toronto calendar days and never becomes negative', () => {
  assert.equal(daysUntil('2027-08-21T07:30:00-04:00', new Date('2027-08-20T23:30:00-04:00')), 1);
  assert.equal(daysUntil('2027-08-21T07:30:00-04:00', new Date('2027-08-21T00:00:00-04:00')), 0);
  assert.equal(daysUntil('2027-08-21T07:30:00-04:00', new Date('2028-01-01')), 0);
});
test('Calendar includes confirmed reception only, no invented location or ending, and folds UTF-8 safely', () => {
  const s = {
    title: 'Ride For Brains',
    edition: '2e édition',
    date: '2027-08-21',
    eventAt: '2027-08-21T07:30:00-04:00',
    reception: '07:30',
    location: null,
  };
  const ics = calendarICS(s, 'https://rideforbrains.ca', new Date('2026-10-30'));
  assert.match(ics, /DTSTART:20270821T113000Z/);
  assert.ok(!ics.includes('LOCATION:'));
  assert.ok(!ics.includes('DTEND:'));
  assert.ok(!ics.includes('undefined'));
  const long = calendarICS({ ...s, title: 'É'.repeat(150) }, 'https://rideforbrains.ca');
  assert.ok(long.split('\r\n').every((line) => Buffer.byteLength(line) <= 75));
  assert.match(
    calendarICS({ ...s, location: 'Parc, Nord' }, 'https://rideforbrains.ca'),
    /LOCATION:Parc\\, Nord/,
  );
  const google = new URL(googleCalendarUrl(s, 'https://rideforbrains.ca'));
  assert.equal(google.searchParams.get('ctz'), 'America/Toronto');
  assert.equal(google.searchParams.has('location'), false);
});
test('Editorial defaults reveal no invented photographs or statistics and visibility order is stable', () => {
  const e = editorial({});
  assert.deepEqual(
    e.team.map((t) => t.name),
    ['Thomas', 'François-Xavier', 'Sammy'],
  );
  assert.equal(e.firstEdition.stats.length, 0);
  assert.ok(e.team.every((t) => !t.photo && !t.story));
  assert.equal(e.transfersEnabled, false);
  assert.deepEqual(
    published([
      { id: 1, order: 2 },
      { id: 2, enabled: false },
      { id: 3, order: 0 },
    ]).map((r) => r.id),
    [3, 1],
  );
});
