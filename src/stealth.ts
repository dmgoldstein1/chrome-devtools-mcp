
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utilities for applying basic bot‑evasion tweaks to pages that are controlled
 * by Puppeteer.  Sites often look for tell‑tale signs of automation such as
 * `navigator.webdriver` being true, the presence of the word "Headless" in the
 * user agent, or missing `window.chrome`.
 *
 * The technique used here is intentionally modest: we inject a small script on
 * every new document and automatically patch pages as they are created.  This
 * keeps the logic out of higher‑level code and avoids pulling in an entire
 * "stealth" library.
 */

import type {
  Browser,
  Page,
  Target,
} from './third_party/index.js';

// Keep track of browsers we've already patched so we only install the
// handlers once per instance.
const installedBrowsers = new WeakSet<Browser>();

/**
 * Apply bot-evasion tricks to a single puppeteer `page`.
 */
async function applyStealthToPage(page: Page): Promise<void> {
  // This helper tries hard to patch a page but never throws: callers should
  // swallow any errors so bot evasion remains a best‑effort feature.

  const stealthScript = () => {
    // navigator.webdriver should be false in normal browsers.
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true,
    });

    // Some checks look at languages/plugins values.
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
      configurable: true,
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
      configurable: true,
    });

    // Expose a minimal `chrome.runtime` object, which some sites check for.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).chrome = (window as any).chrome || {runtime: {}};

    // Remove "Headless" from the user agent if present.
    try {
      const original = navigator.userAgent;
      const ua = original.replace('HeadlessChrome/', 'Chrome/');
      Object.defineProperty(navigator, 'userAgent', {
        get: () => ua,
        configurable: true,
      });
    } catch {
      // ignore failures, this property is not always writable
    }

    // Override a couple of WebGL parameters that are commonly used for
    // fingerprinting.
    try {
      const getParameter =
        WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (param) {
        // UNMASKED_VENDOR_WEBGL
        if (param === 37445) {
          return 'Google Inc.';
        }
        // UNMASKED_RENDERER_WEBGL
        if (param === 37446) {
          return 'ANGLE (Apple, Safari)';
        }
        return getParameter.call(this, param);
      };
    } catch {
      // if WebGL is not available just skip
    }

    // Avoid the "AutomationControlled" Blink feature, which is enabled by
    // --disable-blink-features=AutomationControlled; we still detect in the
    // user agent above but some sites also check for the feature being
    // switched on.
    try {
      Object.defineProperty(navigator, 'permissions', {
        get: () => ({
          // tslint:disable-next-line:no-explicit-any
          query: (params: any) =>
            params.name === 'notifications'
              ? Promise.resolve({state: Notification.permission})
              : window.navigator.permissions.query(params),
        }),
        configurable: true,
      });
    } catch {
      // permissions may not be overwritable, ignore.
    }
  };

  // evaluateOnNewDocument ensures the snippet runs before any other script on
  // the page, giving us the best chance to hide automation features.
  try {
    await page.evaluateOnNewDocument(stealthScript);
  } catch (err) {
    // some targets (e.g. internal pages) may reject this call
    // eslint-disable-next-line no-console
    console.warn('stealth: evaluateOnNewDocument failed', err);
  }

  // apply immediately on the existing document, if possible.  This may fail
  // if the page is a special URL where script execution is disallowed, but we
  // don't care about those.
  try {
    await page.evaluate(stealthScript);
  } catch {
    // ignore failures
  }
}

/**
 * Apply stealth patches to all existing pages and make sure future pages are
 * patched automatically.
 */
export async function applyBotEvasion(browser: Browser): Promise<void> {
  const pages = await browser.pages();
  for (const p of pages) {
    try {
      await applyStealthToPage(p);
    } catch (err) {
      // swallow; bot evasion is best-effort
      // eslint-disable-next-line no-console
      console.warn('stealth: failed to patch page', err);
    }
  }

  browser.on('targetcreated', async (target: Target) => {
    try {
      const page = await target.page();
      if (page) {
        await applyStealthToPage(page);
      }
    } catch (err) {
      // swallow; bot evasion is best-effort
      // eslint-disable-next-line no-console
      console.warn('stealth: failed to patch new page', err);
    }
  });

  // Wrapping newPage ensures callers creating pages via the Puppeteer API get
  // a patched page synchronously.
  try {
    const origNewPage = browser.newPage.bind(browser);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (browser as any).newPage = async function (options?: any) {
      const page = await origNewPage(options);
      try {
        await applyStealthToPage(page);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('stealth: failed to patch page from newPage', err);
      }
      return page;
    };
  } catch {
    // if the browser object is frozen or otherwise unmodifiable, ignore
  }
}

/**
 * Public helper that installs bot-evasion on the given browser only once.
 */
export function installBotEvasion(browser: Browser): void {
  if (installedBrowsers.has(browser)) {
    return;
  }
  installedBrowsers.add(browser);
  void applyBotEvasion(browser).catch(err => {
    // eslint-disable-next-line no-console
    console.warn('stealth: initial patch failed', err);
  });
}
