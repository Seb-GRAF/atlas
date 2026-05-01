import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDriveCacheKey,
  buildTransitCacheKey,
  clearCommuteFields,
  formatMinutesText,
  formatTransitLocation,
  getCachedRoute,
  isCacheFresh,
  normalizeTransitConnection,
  parseTransportDurationToMinutes,
  resolveNextMondayDateIso,
  projectRetainedCommuteFields,
  setCachedRoute,
  setCommuteFailureFields,
  setCommuteSuccessFields,
  shouldRecomputeListingCommute
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
  assert.equal(resolveNextMondayDateIso(new Date('2026-05-04T00:30:00+02:00')), '2026-05-04');
  assert.equal(resolveNextMondayDateIso(new Date('2026-05-05T10:00:00+02:00')), '2026-05-11');
});

test('buildTransitCacheKey includes arrival policy and normalized addresses', () => {
  assert.equal(
    buildTransitCacheKey('Rue A 1, Suisse', 'Rue B 2, Suisse'),
    'transit:arrival-next-monday-0800:rue a 1, suisse->rue b 2, suisse'
  );
});

test('formatTransitLocation prefers coordinates when available', () => {
  assert.equal(
    formatTransitLocation({ lat: 46.544986724853516, lon: 6.676456451416016 }, 'Hospital CHUV Centre Sylvana (VD) - Epalinges'),
    '46.544987,6.676456'
  );
  assert.equal(formatTransitLocation(null, 'Epalinges, Croisettes'), 'Epalinges, Croisettes');
  assert.equal(formatTransitLocation({ lat: Number.NaN, lon: 6.67 }, 'Epalinges, Croisettes'), 'Epalinges, Croisettes');
});

test('buildDriveCacheKey formats coordinates and rejects invalid points', () => {
  assert.equal(
    buildDriveCacheKey({ lat: 46.123456, lon: 6.987654 }, { lat: 47.1, lon: 7.2 }),
    'drive:46.12346,6.98765->47.10000,7.20000'
  );

  assert.throws(
    () => buildDriveCacheKey({ lat: Number.NaN, lon: 6.987654 }, { lat: 47.1, lon: 7.2 }),
    /Invalid route coordinates/
  );
  assert.throws(
    () => buildDriveCacheKey(null, { lat: 47.1, lon: 7.2 }),
    /Invalid route coordinates/
  );
});

test('cache helpers store normalized route entries and report freshness', () => {
  const routeCache = {};
  const route = { legs: [{ type: 'drive', minutes: 32 }] };

  setCachedRoute(routeCache, 'drive:a->b', {
    minutes: 31.6,
    route,
    status: 'cached-stale'
  });

  const entry = routeCache['drive:a->b'];
  assert.equal(entry.minutes, 32);
  assert.equal(entry.route, route);
  assert.equal(entry.status, 'cached-stale');
  assert.match(entry.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  assert.equal(isCacheFresh(null, 1000), false);
  assert.equal(isCacheFresh({ updatedAt: new Date(Date.now() - 2000).toISOString() }, 1000), false);
  assert.equal(isCacheFresh({ updatedAt: new Date().toISOString() }, 1000), true);

  assert.deepEqual(getCachedRoute(routeCache, 'missing', 1000), {
    hasValue: false,
    fresh: false,
    entry: null,
    minutes: null,
    route: null
  });

  assert.deepEqual(getCachedRoute(routeCache, 'drive:a->b', 1000), {
    hasValue: true,
    fresh: true,
    entry,
    minutes: 32,
    route
  });

  routeCache['drive:old->b'] = {
    minutes: 28.2,
    route: { legs: [] },
    status: 'ok',
    updatedAt: new Date(Date.now() - 2000).toISOString()
  };
  const stale = getCachedRoute(routeCache, 'drive:old->b', 1000);
  assert.equal(stale.hasValue, true);
  assert.equal(stale.fresh, false);
  assert.equal(stale.minutes, 28);
  assert.deepEqual(stale.route, { legs: [] });
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
        minutes: 5,
        coords: []
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
        minutes: 15,
        coords: []
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
        minutes: 4,
        coords: []
      }
    ]
  });
});

test('normalizeTransitConnection extracts station coordinates and journey passList into leg.coords', () => {
  const connection = {
    sections: [
      {
        journey: null,
        walk: { duration: 180 },
        departure: {
          station: { name: 'Lausanne, Av. de la Gare', coordinate: { type: 'WGS84', x: 46.5170, y: 6.6320 } },
          departure: '2026-05-04T07:09:00+0200'
        },
        arrival: {
          station: { name: 'Lausanne, gare', coordinate: { type: 'WGS84', x: 46.5176, y: 6.6296 } },
          arrival: '2026-05-04T07:12:00+0200'
        }
      },
      {
        journey: {
          category: 'IC',
          number: '1',
          to: 'Geneva',
          passList: [
            { station: { name: 'Lausanne', coordinate: { type: 'WGS84', x: 46.5168, y: 6.6291 } }, departure: '2026-05-04T07:15:00+0200' },
            { station: { name: 'Renens VD', coordinate: { type: 'WGS84', x: 46.5378, y: 6.5786 } }, departure: '2026-05-04T07:20:00+0200' },
            { station: { name: 'Morges', coordinate: { type: 'WGS84', x: 46.5099, y: 6.4983 } }, arrival: '2026-05-04T07:30:00+0200' }
          ]
        },
        walk: null,
        departure: { station: { name: 'Lausanne', coordinate: { type: 'WGS84', x: 46.5168, y: 6.6291 } }, departure: '2026-05-04T07:15:00+0200' },
        arrival: { station: { name: 'Morges', coordinate: { type: 'WGS84', x: 46.5099, y: 6.4983 } }, arrival: '2026-05-04T07:30:00+0200' }
      }
    ]
  };

  const result = normalizeTransitConnection(connection, { date: '2026-05-04', arrivalTime: '08:00' });
  assert.deepEqual(result.legs[0].coords, [[6.6320, 46.5170], [6.6296, 46.5176]]);
  // Transit leg keeps the full passList; endpoints already match passList edges.
  assert.deepEqual(result.legs[1].coords, [[6.6291, 46.5168], [6.5786, 46.5378], [6.4983, 46.5099]]);
});

test('normalizeTransitConnection handles missing station coordinates gracefully', () => {
  const connection = {
    sections: [
      {
        journey: null,
        walk: { duration: 60 },
        departure: { station: { name: 'No Coord' }, departure: '2026-05-04T07:00:00+0200' },
        arrival: { station: { name: 'Other', coordinate: { type: 'WGS84', x: 46.0, y: 6.0 } }, arrival: '2026-05-04T07:01:00+0200' }
      }
    ]
  };
  const result = normalizeTransitConnection(connection, { date: '2026-05-04', arrivalTime: '08:00' });
  // Missing coordinate is omitted, not replaced with NaN/null.
  assert.deepEqual(result.legs[0].coords, [[6.0, 46.0]]);
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

test('setCommuteSuccessFields preserves explicit route statuses', () => {
  const listing = {};
  setCommuteSuccessFields(listing, {
    workAddress: 'Rue Etraz 4, Lausanne',
    distanceKm: 12.4,
    driveMinutes: 31,
    driveStatus: 'cached-stale',
    transitMinutes: 42,
    transitStatus: 'cached-stale',
    transitRoute: null
  });

  assert.equal(listing.driveRouteStatus, 'cached-stale');
  assert.equal(listing.transitRouteStatus, 'cached-stale');
});

test('setCommuteFailureFields is visible and clearCommuteFields resets old values', () => {
  const listing = { driveMinutes: 31, driveText: '31 min', transitText: '42 min', commuteWarnings: [] };
  setCommuteFailureFields(listing, 'route-failed', 'Transport public indisponible');
  assert.equal(listing.driveMinutes, null);
  assert.equal(listing.driveText, '');
  assert.equal(listing.driveRouteStatus, 'route-failed');
  assert.equal(listing.transitRouteStatus, 'route-failed');
  assert.deepEqual(listing.commuteWarnings, ['Transport public indisponible']);

  clearCommuteFields(listing);
  assert.equal(listing.driveText, '');
  assert.equal(listing.transitText, '');
  assert.equal(listing.transitRouteStatus, 'missing-address');
});

test('projectRetainedCommuteFields clears stale retained commute when workplace geocode fails', () => {
  const fields = projectRetainedCommuteFields({
    distanceKm: 12.4,
    distanceText: '12.4 km',
    distanceComputed: true,
    distanceFromWorkAddress: 'Ancienne adresse',
    driveMinutes: 31,
    driveText: '31 min',
    driveRouteStatus: 'ok',
    transitMinutes: 42,
    transitText: '42 min',
    transitRouteStatus: 'ok',
    commuteWarnings: []
  }, {
    visible: true,
    workAddress: 'Rue Etraz 4, Lausanne',
    workCoords: null
  });

  assert.equal(fields.distanceComputed, false);
  assert.equal(fields.distanceKm, null);
  assert.equal(fields.distanceText, '');
  assert.equal(fields.distanceFromWorkAddress, 'Rue Etraz 4, Lausanne');
  assert.equal(fields.driveMinutes, null);
  assert.equal(fields.driveRouteStatus, 'geocode-failed');
  assert.equal(fields.transitRouteStatus, 'geocode-failed');
  assert.match(fields.commuteWarnings[0], /Rue Etraz 4, Lausanne/);
});

test('projectRetainedCommuteFields marks retained commute for recompute when workplace changes', () => {
  const fields = projectRetainedCommuteFields({
    distanceKm: 12.4,
    distanceText: '12.4 km',
    distanceComputed: true,
    distanceFromWorkAddress: 'Ancienne adresse',
    driveMinutes: 31,
    driveText: '31 min',
    driveRouteStatus: 'ok',
    transitMinutes: 42,
    transitText: '42 min',
    transitRouteStatus: 'ok',
    commuteWarnings: []
  }, {
    visible: true,
    workAddress: 'Rue Etraz 4, Lausanne',
    workCoords: { lat: 46.5218, lon: 6.6336 }
  });

  assert.equal(fields.distanceComputed, false);
  assert.equal(fields.distanceKm, null);
  assert.equal(fields.distanceText, '');
  assert.equal(fields.distanceFromWorkAddress, 'Rue Etraz 4, Lausanne');
  assert.equal(fields.driveMinutes, null);
  assert.equal(fields.driveRouteStatus, 'route-failed');
  assert.equal(fields.transitRouteStatus, 'route-failed');
  assert.deepEqual(fields.commuteWarnings, ["Trajet à recalculer pour l'adresse de travail actuelle."]);
});

test('projectRetainedCommuteFields preserves retained commute when workplace matches', () => {
  const fields = projectRetainedCommuteFields({
    distanceKm: 12.4,
    distanceText: '12.4 km',
    distanceComputed: true,
    distanceFromWorkAddress: 'Rue Etraz 4, Lausanne',
    driveMinutes: 31,
    driveRouteStatus: 'ok',
    transitMinutes: 42,
    transitRouteStatus: 'ok'
  }, {
    visible: true,
    workAddress: 'Rue Etraz 4, Lausanne',
    workCoords: { lat: 46.5218, lon: 6.6336 }
  });

  assert.equal(fields.distanceComputed, true);
  assert.equal(fields.distanceKm, 12.4);
  assert.equal(fields.driveText, '31 min');
  assert.equal(fields.transitText, '42 min');
  assert.equal(fields.distanceFromWorkAddress, 'Rue Etraz 4, Lausanne');
});

test('formatMinutesText only formats finite positive minutes', () => {
  assert.equal(formatMinutesText(31), '31 min');
  assert.equal(formatMinutesText(0), '');
  assert.equal(formatMinutesText(null), '');
});

test('shouldRecomputeListingCommute only includes active or triage listings', () => {
  assert.equal(shouldRecomputeListingCommute({ status: 'À trier' }), true);
  assert.equal(shouldRecomputeListingCommute({ status: 'À contacter' }), true);
  assert.equal(shouldRecomputeListingCommute({ status: 'Contacté' }), true);
  assert.equal(shouldRecomputeListingCommute({ status: 'Visite prévue' }), true);
  assert.equal(shouldRecomputeListingCommute({ status: 'Dossier à envoyer' }), true);
  assert.equal(shouldRecomputeListingCommute({ status: 'Dossier envoyé' }), true);
  assert.equal(shouldRecomputeListingCommute({ status: 'Relance à faire' }), true);

  assert.equal(shouldRecomputeListingCommute({ status: 'Accepté' }), false);
  assert.equal(shouldRecomputeListingCommute({ status: 'Écartée' }), false);
  assert.equal(shouldRecomputeListingCommute({ status: 'Refus régie' }), false);
  assert.equal(shouldRecomputeListingCommute({ status: 'À trier', isRemoved: true }), false);
});
