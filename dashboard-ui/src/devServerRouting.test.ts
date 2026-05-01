// @vitest-environment node
import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

describe('dev server routing', () => {
  it('proxies the legacy profile manager to the API server', () => {
    expect(viteConfig.server?.proxy).toMatchObject({
      '/dashboard': 'http://127.0.0.1:8787'
    });
  });
});
