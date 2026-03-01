/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import {describe, it} from 'node:test';

import {executablePath} from 'puppeteer';

import {detectDisplay, ensureBrowserConnected, launch} from '../src/browser.js';

describe('browser', () => {
  it('detects display does not crash', () => {
    detectDisplay();
  });

  it('cannot launch multiple times with the same profile', async () => {
    const tmpDir = os.tmpdir();
    const folderPath = path.join(tmpDir, `temp-folder-${crypto.randomUUID()}`);
    const browser1 = await launch({
      headless: true,
      isolated: false,
      userDataDir: folderPath,
      executablePath: executablePath(),
      devtools: false,
    });
    try {
      try {
        const browser2 = await launch({
          headless: true,
          isolated: false,
          userDataDir: folderPath,
          executablePath: executablePath(),
          devtools: false,
        });
        await browser2.close();
        assert.fail('not reached');
      } catch (err) {
        assert.strictEqual(
          err.message,
          `The browser is already running for ${folderPath}. Use --isolated to run multiple browser instances.`,
        );
      }
    } finally {
      await browser1.close();
    }
  });

  it('launches with the initial viewport', async () => {
    const tmpDir = os.tmpdir();
    const folderPath = path.join(tmpDir, `temp-folder-${crypto.randomUUID()}`);
    const browser = await launch({
      headless: true,
      isolated: false,
      userDataDir: folderPath,
      executablePath: executablePath(),
      viewport: {
        width: 1501,
        height: 801,
      },
      devtools: false,
    });
    try {
      const [page] = await browser.pages();
      const result = await page.evaluate(() => {
        return {width: window.innerWidth, height: window.innerHeight};
      });
      assert.deepStrictEqual(result, {
        width: 1501,
        height: 801,
      });
    } finally {
      await browser.close();
    }
  });
  it('connects to an existing browser with userDataDir', async () => {
    const tmpDir = os.tmpdir();
    const folderPath = path.join(tmpDir, `temp-folder-${crypto.randomUUID()}`);
    const browser = await launch({
      headless: true,
      isolated: false,
      userDataDir: folderPath,
      executablePath: executablePath(),
      devtools: false,
      chromeArgs: ['--remote-debugging-port=0'],
    });
    try {
      const connectedBrowser = await ensureBrowserConnected({
        userDataDir: folderPath,
        devtools: false,
      });
      assert.ok(connectedBrowser);
      assert.ok(connectedBrowser.connected);
      // pages should also be patched after connecting
      const [connPage] = await connectedBrowser.pages();
      const connWebdriver = await connPage.evaluate(() => navigator.webdriver);
      assert.strictEqual(connWebdriver, false);
      connectedBrowser.disconnect();
    } finally {
      await browser.close();
    }
  });

  it('applies bot evasion to pages', async () => {
    const tmpDir = os.tmpdir();
    const folderPath = path.join(tmpDir, `temp-folder-${crypto.randomUUID()}`);
    const browser = await launch({
      headless: true,
      isolated: false,
      userDataDir: folderPath,
      executablePath: executablePath(),
      devtools: false,
    });
    try {
      const pagesList = await browser.pages();
      const urls = await Promise.all(pagesList.map(p => p.url()));
      // surface urls in case of failure
      if (urls.length === 0) {
        assert.fail('no pages returned');
      }
      const page = pagesList[0];
      const webdriver = await page.evaluate(() => navigator.webdriver);
      if (webdriver !== false) {
        throw new Error(
          `navigator.webdriver still true (${webdriver}) on pages ${urls.join(',')}`,
        );
      }

      const ua = await page.evaluate(() => navigator.userAgent);
      assert(!ua.includes('Headless'), 'userAgent should not contain Headless');

      // new pages should also be patched
      const newPage = await browser.newPage();
      const webdriver2 = await newPage.evaluate(() => navigator.webdriver);
      assert.strictEqual(webdriver2, false);
      await newPage.close();
    } finally {
      await browser.close();
    }
  });
});
