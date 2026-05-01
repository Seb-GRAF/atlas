#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dashboard-ui', 'public', 'favicons');

const PROVIDERS = [
  { key: 'immobilier.ch',         file: 'immobilier-ch',         site: 'https://www.immobilier.ch' },
  { key: 'flatfox.ch',            file: 'flatfox-ch',            site: 'https://flatfox.ch' },
  { key: 'naef.ch',               file: 'naef-ch',               site: 'https://www.naef.ch' },
  { key: 'bernard-nicod',         file: 'bernard-nicod',         site: 'https://www.bernard-nicod.ch' },
  { key: 'Retraites Populaires',  file: 'retraites-populaires',  site: 'https://www.retraitespopulaires.ch' },
  { key: 'anibis.ch',             file: 'anibis-ch',             site: 'https://www.anibis.ch' },
  { key: 'Facebook Marketplace',  file: 'facebook-marketplace',  site: 'https://www.facebook.com' }
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept': 'text/html,*/*' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

async function fetchBinary(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept': 'image/*,*/*' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || '';
  return { buf, contentType, finalUrl: res.url };
}

function parseSize(sizesAttr) {
  if (!sizesAttr) return 0;
  if (/any/i.test(sizesAttr)) return 1024;
  const m = sizesAttr.match(/(\d+)x(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function extToType(url, contentType) {
  const lc = url.toLowerCase().split('?')[0];
  if (contentType.includes('svg') || lc.endsWith('.svg')) return 'svg';
  if (contentType.includes('png') || lc.endsWith('.png')) return 'png';
  if (contentType.includes('icon') || lc.endsWith('.ico')) return 'ico';
  if (contentType.includes('jpeg') || lc.endsWith('.jpg') || lc.endsWith('.jpeg')) return 'jpg';
  if (contentType.includes('webp') || lc.endsWith('.webp')) return 'webp';
  return 'png';
}

function rankCandidate(c) {
  // Prefer png at high res, then svg, then apple-touch-icon, then ico
  const isSvg = /\.svg(\?|$)/i.test(c.href);
  const isIco = /\.ico(\?|$)/i.test(c.href);
  const isPng = /\.png(\?|$)/i.test(c.href);
  let base = 0;
  if (isPng) base = 100;
  else if (isSvg) base = 90;
  else if (c.rel.includes('apple-touch-icon')) base = 80;
  else if (isIco) base = 50;
  else base = 60;
  return base + Math.min(c.size, 512) / 10;
}

function pickIconFromHtml(html, baseUrl) {
  const dom = new JSDOM(html, { url: baseUrl });
  const links = Array.from(dom.window.document.querySelectorAll('link[rel]'));
  const candidates = [];
  for (const link of links) {
    const rel = (link.getAttribute('rel') || '').toLowerCase();
    if (!/(^|\s)(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed|mask-icon)(\s|$)/.test(rel)) continue;
    const href = link.getAttribute('href');
    if (!href) continue;
    let abs;
    try { abs = new URL(href, baseUrl).toString(); } catch { continue; }
    candidates.push({
      href: abs,
      rel,
      size: parseSize(link.getAttribute('sizes'))
    });
  }
  candidates.sort((a, b) => rankCandidate(b) - rankCandidate(a));
  return candidates[0]?.href ?? null;
}

async function downloadFavicon(provider) {
  const { key, file, site } = provider;
  let chosenUrl = null;
  let pickedFrom = '';
  try {
    const html = await fetchText(site);
    chosenUrl = pickIconFromHtml(html, site);
    if (chosenUrl) pickedFrom = 'html <link>';
  } catch (err) {
    console.warn(`[${key}] HTML fetch failed: ${err.message}`);
  }
  if (!chosenUrl) {
    chosenUrl = new URL('/favicon.ico', site).toString();
    pickedFrom = '/favicon.ico fallback';
  }

  const { buf, contentType, finalUrl } = await fetchBinary(chosenUrl);
  const ext = extToType(finalUrl, contentType);
  const outPath = path.join(OUT_DIR, `${file}.${ext}`);
  await writeFile(outPath, buf);
  console.log(`[${key}] ${pickedFrom} -> ${chosenUrl} (${buf.length} bytes, ${contentType || 'no content-type'}) -> ${path.relative(ROOT, outPath)}`);
  return { key, file, ext, bytes: buf.length };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const results = [];
  for (const provider of PROVIDERS) {
    try {
      results.push(await downloadFavicon(provider));
    } catch (err) {
      console.error(`[${provider.key}] FAILED: ${err.message}`);
      results.push({ key: provider.key, error: err.message });
    }
  }
  console.log('\nSummary:');
  for (const r of results) {
    if (r.error) console.log(`  ✗ ${r.key}: ${r.error}`);
    else console.log(`  ✓ ${r.key}: ${r.file}.${r.ext} (${r.bytes} bytes)`);
  }
  const failed = results.filter((r) => r.error).length;
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
