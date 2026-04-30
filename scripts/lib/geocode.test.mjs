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

test('parsePhotonPoint returns first valid feature coordinate pair', () => {
  assert.deepEqual(parsePhotonPoint({
    features: [{ geometry: { coordinates: [6.63, 46.52] } }]
  }), { lat: 46.52, lon: 6.63 });
  assert.equal(parsePhotonPoint({ features: [] }), null);
});

test('geocodeAddress falls back to geo.admin after empty Nominatim result and overwrites cached null', async () => {
  const cache = {
    'hospital chuv centre sylvana (vd) - epalinges': null
  };
  const requested = [];

  const point = await geocodeAddress('Hospital CHUV Centre Sylvana (VD) - Epalinges', cache, {
    fetchJson: async (url) => {
      requested.push(url);
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
  assert.equal(requested.length, 2);
  assert.ok(requested[0].includes('nominatim.openstreetmap.org'));
  assert.ok(requested[1].includes('api3.geo.admin.ch'));
  assert.deepEqual(cache['hospital chuv centre sylvana (vd) - epalinges'], point);
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
