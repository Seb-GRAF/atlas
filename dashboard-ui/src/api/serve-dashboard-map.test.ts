import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');
const profile = 'map-precision-test';
const profileDir = path.join(rootDir, 'data/profiles', profile);

let serverProcess: ChildProcessWithoutNullStreams | null = null;
let geoServer: Awaited<ReturnType<typeof startGeoStub>> | null = null;

async function getFreePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not resolve test server port')));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function writeProfileData() {
  await fs.rm(profileDir, { recursive: true, force: true });
  await fs.mkdir(profileDir, { recursive: true });
  await fs.writeFile(
    path.join(profileDir, 'watch-config.json'),
    JSON.stringify({ areas: [{ label: 'Lausanne' }], preferences: {} }, null, 2)
  );
  await fs.writeFile(
    path.join(profileDir, 'tracker.json'),
    JSON.stringify(
      {
        listings: [
          { id: 'city', address: 'Lausanne', area: 'Lausanne' },
          { id: 'postcode', address: '1004 Lausanne', area: 'Lausanne' },
          { id: 'street', address: 'Rue St-Roch 8, 1004 Lausanne', area: 'Lausanne' }
        ],
        statuses: [],
        statusWorkflowVersion: 2
      },
      null,
      2
    )
  );
  await fs.writeFile(path.join(profileDir, 'latest-listings.json'), JSON.stringify({ all: [], matching: [], newListings: [] }, null, 2));
  await fs.writeFile(
    path.join(profileDir, 'geocode-cache.json'),
    JSON.stringify(
      {
        'lausanne, suisse': { lat: 46.5197, lon: 6.6323 },
        '1004 lausanne, suisse': { lat: 46.5262, lon: 6.6141 },
        'rue st-roch 8, 1004 lausanne, suisse': { lat: 46.5222, lon: 6.6254 }
      },
      null,
      2
    )
  );
}

async function startServer(port: number, env: Record<string, string> = {}) {
  serverProcess = spawn(process.execPath, ['scripts/serve-dashboard.mjs'], {
    cwd: rootDir,
    env: { ...process.env, ...env, PORT: String(port), APARTMENT_PROFILE: profile }
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for test server')), 5000);

    serverProcess?.stdout.on('data', (chunk) => {
      if (String(chunk).includes('Dashboard local prêt')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProcess?.stderr.on('data', (chunk) => {
      clearTimeout(timeout);
      reject(new Error(String(chunk)));
    });
    serverProcess?.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Test server exited early with code ${code}`));
    });
  });
}

async function startGeoStub(point: { lat: number; lon: number }) {
  const http = await import('node:http');
  const requests: string[] = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    requests.push(url.searchParams.get('searchText') || '');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      results: [
        {
          attrs: {
            label: 'Rue Jean-Louis-de-Bons 5 <b>1006 Lausanne</b>',
            lat: point.lat,
            lon: point.lon,
            origin: 'address'
          }
        }
      ]
    }));
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not resolve geo stub port')));
        return;
      }
      resolve(address.port);
    });
  });

  return {
    url: `http://127.0.0.1:${port}/search`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

afterEach(async () => {
  if (serverProcess) {
    serverProcess.kill();
    await new Promise((resolve) => serverProcess?.once('exit', resolve));
    serverProcess = null;
  }
  if (geoServer) {
    await geoServer.close();
    geoServer = null;
  }
  await fs.rm(profileDir, { recursive: true, force: true });
});

describe('/api/state map precision', () => {
  it('keeps city and postcode locations on the map as approximate area markers', async () => {
    await writeProfileData();
    const port = await getFreePort();
    await startServer(port, { MAP_GEOCODE_ON_STATE: '0' });

    const response = await fetch(`http://127.0.0.1:${port}/api/state?profile=${profile}`);
    const state = await response.json();
    const byId = Object.fromEntries(state.tracker.listings.map((item: any) => [item.id, item]));

    expect(response.status).toBe(200);
    expect(byId.city.mapLocation).toMatchObject({ precision: 'area', query: 'Lausanne, Suisse' });
    expect(byId.postcode.mapLocation).toMatchObject({ precision: 'area', query: '1004 Lausanne, Suisse' });
    expect(byId.street.mapLocation).toMatchObject({ precision: 'address', query: 'Rue St-Roch 8, 1004 Lausanne, Suisse' });
    expect(state.map.listingsWithCoordinates).toBe(3);
    expect(state.map.listingsMissingCoordinates).toBe(0);
  });

  it('falls back to an approximate area marker when a street address is not cached', async () => {
    await fs.rm(profileDir, { recursive: true, force: true });
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(
      path.join(profileDir, 'watch-config.json'),
      JSON.stringify({ areas: [{ label: 'Lausanne' }], preferences: {} }, null, 2)
    );
    await fs.writeFile(
      path.join(profileDir, 'tracker.json'),
      JSON.stringify(
        {
          listings: [
            { id: 'street-missing', address: 'Lausanne, Chemin du Cache-Manquant 9', area: 'Lausanne' }
          ],
          statuses: [],
          statusWorkflowVersion: 2
        },
        null,
        2
      )
    );
    await fs.writeFile(path.join(profileDir, 'latest-listings.json'), JSON.stringify({ all: [], matching: [], newListings: [] }, null, 2));
    await fs.writeFile(
      path.join(profileDir, 'geocode-cache.json'),
      JSON.stringify({ '1003 lausanne, suisse': { lat: 46.5207542, lon: 6.6315829 } }, null, 2)
    );

    const port = await getFreePort();
    await startServer(port, { MAP_GEOCODE_ON_STATE: '0' });

    const response = await fetch(`http://127.0.0.1:${port}/api/state?profile=${profile}`);
    const state = await response.json();
    const listing = state.tracker.listings[0];

    expect(response.status).toBe(200);
    expect(listing.mapLocation).toMatchObject({
      lat: 46.5207542,
      lon: 6.6315829,
      precision: 'area',
      query: '1003 lausanne, suisse'
    });
    expect(state.map.listingsWithCoordinates).toBe(1);
    expect(state.map.listingsMissingCoordinates).toBe(0);
  });

  it('geocodes missing street addresses before using approximate area fallback', async () => {
    await fs.rm(profileDir, { recursive: true, force: true });
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(
      path.join(profileDir, 'watch-config.json'),
      JSON.stringify({ areas: [{ label: 'Lausanne' }], preferences: {} }, null, 2)
    );
    await fs.writeFile(
      path.join(profileDir, 'tracker.json'),
      JSON.stringify(
        {
          listings: [
            {
              id: 'street-missing',
              address: 'Lausanne, Rue Jean-Louis-de-Bons 5',
              area: 'Lausanne',
              status: 'À trier',
              display: true
            }
          ],
          statuses: [],
          statusWorkflowVersion: 2
        },
        null,
        2
      )
    );
    await fs.writeFile(path.join(profileDir, 'latest-listings.json'), JSON.stringify({ all: [], matching: [], newListings: [] }, null, 2));
    await fs.writeFile(
      path.join(profileDir, 'geocode-cache.json'),
      JSON.stringify({ '1007 lausanne, suisse': { lat: 46.5172768, lon: 6.6149266 } }, null, 2)
    );
    geoServer = await startGeoStub({ lat: 46.5142784, lon: 6.6265154 });

    const port = await getFreePort();
    await startServer(port, { GEO_ADMIN_SEARCH_URL: geoServer.url });

    const response = await fetch(`http://127.0.0.1:${port}/api/state?profile=${profile}`);
    const state = await response.json();
    const listing = state.tracker.listings[0];

    expect(response.status).toBe(200);
    expect(geoServer.requests).toEqual(['Rue Jean-Louis-de-Bons 5, Lausanne']);
    expect(listing.mapLocation).toMatchObject({
      lat: 46.5142784,
      lon: 6.6265154,
      precision: 'address',
      query: 'Lausanne, Rue Jean-Louis-de-Bons 5, Suisse'
    });
    expect(state.map.listingsWithCoordinates).toBe(1);
    expect(state.map.listingsMissingCoordinates).toBe(0);
  });

  it('refreshes stale broad-region cached coordinates instead of rendering them', async () => {
    await fs.rm(profileDir, { recursive: true, force: true });
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(
      path.join(profileDir, 'watch-config.json'),
      JSON.stringify({ areas: [{ label: 'Bussigny' }], preferences: {} }, null, 2)
    );
    await fs.writeFile(
      path.join(profileDir, 'tracker.json'),
      JSON.stringify(
        {
          listings: [
            {
              id: 'stale-street',
              address: 'Bussigny, chemin de la sauge',
              area: 'Bussigny',
              status: 'À trier',
              display: true
            }
          ],
          statuses: [],
          statusWorkflowVersion: 2
        },
        null,
        2
      )
    );
    await fs.writeFile(path.join(profileDir, 'latest-listings.json'), JSON.stringify({ all: [], matching: [], newListings: [] }, null, 2));
    await fs.writeFile(
      path.join(profileDir, 'geocode-cache.json'),
      JSON.stringify(
        {
          'bussigny, chemin de la sauge, suisse': {
            lat: 47.0986213684082,
            lon: 7.954939365386963
          }
        },
        null,
        2
      )
    );
    geoServer = await startGeoStub({ lat: 46.553367614746094, lon: 6.556458473205566 });

    const port = await getFreePort();
    await startServer(port, { GEO_ADMIN_SEARCH_URL: geoServer.url });

    const response = await fetch(`http://127.0.0.1:${port}/api/state?profile=${profile}`);
    const state = await response.json();
    const listing = state.tracker.listings[0];

    expect(response.status).toBe(200);
    expect(geoServer.requests).toEqual(['chemin de la sauge, Bussigny']);
    expect(listing.mapLocation).toMatchObject({
      lat: 46.553367614746094,
      lon: 6.556458473205566,
      precision: 'address',
      query: 'Bussigny, chemin de la sauge, Suisse'
    });
    expect(state.map.listingsWithCoordinates).toBe(1);
    expect(state.map.listingsMissingCoordinates).toBe(0);
  });
});
