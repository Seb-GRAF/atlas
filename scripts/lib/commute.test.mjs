import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTransitCacheKey,
  clearCommuteFields,
  formatMinutesText,
  normalizeTransitConnection,
  parseTransportDurationToMinutes,
  resolveNextMondayDateIso,
  setCommuteFailureFields,
  setCommuteSuccessFields
} from './commute.mjs';

test('parseTransportDurationToMinutes parses Swiss transport durations', () => {
  assert.equal(parseTransportDurationToMinutes('00d00:35:00'), 35);
  assert.equal(parseTransportDurationToMinutes('00d01:02:31'), 63);
  assert.equal(parseTransportDurationToMinutes('01d02:03:00'), 1563);
  assert.equal(parseTransportDurationToMinutes(''), null);
  assert.equal(parseTransportDurationToMinutes('invalid'), null);
});

test('resolveNextMondayDateIso returns same day for Monday and next Monday for Tuesday', () => {
  assert.equal(resolveNextMondayDateIso(new Date('2026-05-04T10:00:00+02:00')), '2026-05-04');
  assert.equal(resolveNextMondayDateIso(new Date('2026-05-05T10:00:00+02:00')), '2026-05-11');
});

test('buildTransitCacheKey includes arrival policy and normalized addresses', () => {
  assert.equal(
    buildTransitCacheKey('Rue A 1, Suisse', 'Rue B 2, Suisse'),
    'transit:arrival-next-monday-0800:rue a 1, suisse->rue b 2, suisse'
  );
});

test('normalizeTransitConnection converts walk and transport sections into route legs', () => {
  const connection = {
    duration: '00d00:35:00',
    products: ['RE33', 'm2'],
    from: { departure: '2026-05-04T07:09:00+0200' },
    to: { arrival: '2026-05-04T07:44:00+0200' },
    sections: [
      {
        journey: null,
        walk: { duration: 300 },
        departure: { station: { name: 'Vevey VD, Av. de la Gare' }, departure: '2026-05-04T07:09:00+0200' },
        arrival: { station: { name: 'Vevey' }, arrival: '2026-05-04T07:14:00+0200' }
      },
      {
        journey: { category: 'RE', number: '33', to: 'Annemasse' },
        walk: null,
        departure: { station: { name: 'Vevey' }, departure: '2026-05-04T07:14:00+0200' },
        arrival: { station: { name: 'Lausanne' }, arrival: '2026-05-04T07:29:00+0200' }
      },
      {
        journey: { category: 'M', number: 'm2', to: 'Lausanne Sallaz' },
        walk: null,
        departure: { station: { name: 'Lausanne, gare' }, departure: '2026-05-04T07:35:00+0200' },
        arrival: { station: { name: 'Lausanne, Bessières' }, arrival: '2026-05-04T07:39:00+0200' }
      }
    ]
  };

  assert.deepEqual(normalizeTransitConnection(connection, { date: '2026-05-04', arrivalTime: '08:00' }), {
    date: '2026-05-04',
    arrivalTime: '08:00',
    departureAt: '2026-05-04T07:09:00+0200',
    arrivalAt: '2026-05-04T07:44:00+0200',
    products: ['RE33', 'm2'],
    legs: [
      {
        type: 'walk',
        mode: 'walk',
        line: '',
        label: 'WALK',
        direction: '',
        from: 'Vevey VD, Av. de la Gare',
        to: 'Vevey',
        departureAt: '2026-05-04T07:09:00+0200',
        arrivalAt: '2026-05-04T07:14:00+0200',
        minutes: 5
      },
      {
        type: 'transit',
        mode: 'RE',
        line: '33',
        label: 'RE33',
        direction: 'Annemasse',
        from: 'Vevey',
        to: 'Lausanne',
        departureAt: '2026-05-04T07:14:00+0200',
        arrivalAt: '2026-05-04T07:29:00+0200',
        minutes: 15
      },
      {
        type: 'transit',
        mode: 'M',
        line: 'm2',
        label: 'M2',
        direction: 'Lausanne Sallaz',
        from: 'Lausanne, gare',
        to: 'Lausanne, Bessières',
        departureAt: '2026-05-04T07:35:00+0200',
        arrivalAt: '2026-05-04T07:39:00+0200',
        minutes: 4
      }
    ]
  });
});

test('setCommuteSuccessFields writes compatibility and structured fields', () => {
  const listing = {};
  setCommuteSuccessFields(listing, {
    workAddress: 'Rue Etraz 4, Lausanne',
    distanceKm: 12.4,
    driveMinutes: 31,
    transitMinutes: 42,
    transitRoute: {
      date: '2026-05-04',
      arrivalTime: '08:00',
      departureAt: '2026-05-04T07:09:00+0200',
      arrivalAt: '2026-05-04T07:44:00+0200',
      products: ['RE33'],
      legs: []
    }
  });

  assert.equal(listing.distanceText, '12.4 km');
  assert.equal(listing.driveText, '31 min');
  assert.equal(listing.transitText, '42 min');
  assert.equal(listing.driveRouteStatus, 'ok');
  assert.equal(listing.transitRouteStatus, 'ok');
  assert.deepEqual(listing.commuteWarnings, []);
});

test('setCommuteFailureFields is visible and clearCommuteFields resets old values', () => {
  const listing = { driveText: '31 min', transitText: '42 min', commuteWarnings: [] };
  setCommuteFailureFields(listing, 'route-failed', 'Transport public indisponible');
  assert.equal(listing.transitRouteStatus, 'route-failed');
  assert.deepEqual(listing.commuteWarnings, ['Transport public indisponible']);

  clearCommuteFields(listing);
  assert.equal(listing.driveText, '');
  assert.equal(listing.transitText, '');
  assert.equal(listing.transitRouteStatus, 'missing-address');
});

test('formatMinutesText only formats finite positive minutes', () => {
  assert.equal(formatMinutesText(31), '31 min');
  assert.equal(formatMinutesText(0), '');
  assert.equal(formatMinutesText(null), '');
});
