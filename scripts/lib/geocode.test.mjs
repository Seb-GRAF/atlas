import test from 'node:test';
import assert from 'node:assert/strict';
import {
  geocodeAddress,
  parseGeoAdminPoint,
  parseNominatimPoint,
  parsePhotonPoint
} from './geocode.mjs';

test('parseNominatimPoint returns first valid coordinate pair', () => {
  assert.deepEqual(parseNominatimPoint([{ lat: '46.52', lon: '6.63' }]), { lat: 46.52, lon: 6.63 });
  assert.equal(parseNominatimPoint([]), null);
  assert.equal(parseNominatimPoint([{ lat: 'x', lon: '6.63' }]), null);
});

test('parseGeoAdminPoint returns first valid Swiss search coordinate pair', () => {
  assert.deepEqual(parseGeoAdminPoint({
    results: [
      {
        attrs: {
          label: '<i>Hospital</i> <b>CHUV Centre Sylvana</b> (VD) - Epalinges',
          lat: 46.544986724853516,
          lon: 6.676456451416016
        }
      }
    ]
  }), { lat: 46.544986724853516, lon: 6.676456451416016 });
  assert.equal(parseGeoAdminPoint({ results: [] }), null);
});

test('parseGeoAdminPoint skips broad gazetteer region results', () => {
  assert.deepEqual(parseGeoAdminPoint({
    results: [
      {
        attrs: {
          origin: 'gazetteer',
          label: '<i>Main Region</i> <b>Plateau Suisse</b>',
          lat: 47.0986213684082,
          lon: 7.954939365386963
        }
      },
      {
        attrs: {
          origin: 'address',
          label: 'Chemin de la Sauge 1 <b>1030 Bussigny</b>',
          lat: 46.553367614746094,
          lon: 6.556458473205566
        }
      }
    ]
  }), { lat: 46.553367614746094, lon: 6.556458473205566 });
});

test('parsePhotonPoint returns first valid feature coordinate pair', () => {
  assert.deepEqual(parsePhotonPoint({
    features: [{ geometry: { coordinates: [6.63, 46.52] } }]
  }), { lat: 46.52, lon: 6.63 });
  assert.equal(parsePhotonPoint({ features: [] }), null);
});

test('geocodeAddress falls back to general geo.admin after official address and Nominatim miss', async () => {
  const cache = {
    'hospital chuv centre sylvana (vd) - epalinges': null
  };
  const requested = [];

  const point = await geocodeAddress('Hospital CHUV Centre Sylvana (VD) - Epalinges', cache, {
    fetchJson: async (url) => {
      requested.push(url);
      if (url.includes('api3.geo.admin.ch') && new URL(url).searchParams.has('origins')) {
        return { results: [] };
      }
      if (url.includes('nominatim.openstreetmap.org')) return [];
      if (url.includes('api3.geo.admin.ch')) {
        return {
          results: [
            {
              attrs: {
                lat: 46.544986724853516,
                lon: 6.676456451416016
              }
            }
          ]
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
    sleep: async () => {}
  });

  assert.deepEqual(point, { lat: 46.544986724853516, lon: 6.676456451416016 });
  assert.equal(requested.length, 3);
  assert.ok(requested[0].includes('api3.geo.admin.ch'));
  assert.ok(requested[0].includes('origins=address%2Cgg25%2Czipcode'));
  assert.ok(requested[1].includes('nominatim.openstreetmap.org'));
  assert.ok(requested[2].includes('api3.geo.admin.ch'));
  assert.deepEqual(cache['hospital chuv centre sylvana (vd) - epalinges'], point);
});

test('geocodeAddress uses Swiss geo.admin address result before global fallbacks', async () => {
  const cache = {
    'bussigny, chemin de la sauge, suisse': null
  };
  const requested = [];

  const point = await geocodeAddress('Bussigny, chemin de la sauge, Suisse', cache, {
    fetchJson: async (url) => {
      requested.push(url);
      if (url.includes('api3.geo.admin.ch')) {
        assert.equal(new URL(url).searchParams.get('origins'), 'address,gg25,zipcode');
        return {
          results: [
            {
              attrs: {
                origin: 'address',
                lat: 46.553367614746094,
                lon: 6.556458473205566
              }
            }
          ]
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
    sleep: async () => {}
  });

  assert.deepEqual(point, { lat: 46.553367614746094, lon: 6.556458473205566 });
  assert.equal(requested.length, 1);
  assert.ok(requested[0].includes('api3.geo.admin.ch'));
  assert.deepEqual(cache['bussigny, chemin de la sauge, suisse'], point);
});

test('geocodeAddress ignores stale broad-region cached point and replaces it', async () => {
  const cache = {
    'bussigny, chemin de la sauge, suisse': { lat: 47.0986213684082, lon: 7.954939365386963 }
  };
  const warnings = [];

  const point = await geocodeAddress('Bussigny, chemin de la sauge, Suisse', cache, {
    warn: (message) => warnings.push(message),
    fetchJson: async (url) => {
      if (url.includes('api3.geo.admin.ch')) {
        return {
          results: [
            {
              attrs: {
                origin: 'address',
                lat: 46.553367614746094,
                lon: 6.556458473205566
              }
            }
          ]
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
    sleep: async () => {}
  });

  assert.deepEqual(point, { lat: 46.553367614746094, lon: 6.556458473205566 });
  assert.deepEqual(cache['bussigny, chemin de la sauge, suisse'], point);
  assert.equal(warnings.length, 1);
});

test('geocodeAddress returns cached valid coordinates without external requests', async () => {
  const cache = {
    'rue test 1': { lat: '46.5', lon: '6.6' }
  };

  const point = await geocodeAddress('Rue Test 1', cache, {
    fetchJson: async () => {
      throw new Error('should not request');
    }
  });

  assert.deepEqual(point, { lat: 46.5, lon: 6.6 });
});
