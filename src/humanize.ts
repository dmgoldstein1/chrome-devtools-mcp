/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {ElementHandle, Page} from './third_party/index.js';

interface HumanizeConfig {
  enabled: boolean;
  seed?: string;
  idleMouse: boolean;
}

const DEFAULT_SEED = 0x1f2e3d4c;

function hashSeed(seed: string | undefined): number {
  if (!seed) {
    return DEFAULT_SEED;
  }
  let value = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

class SeededRandom {
  #state: number;

  constructor(seed: number) {
    this.#state = seed;
  }

  next(): number {
    this.#state = (1664525 * this.#state + 1013904223) >>> 0;
    return this.#state / 0x100000000;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

class Humanizer {
  #config: HumanizeConfig = {
    enabled: false,
    idleMouse: false,
  };
  #rng = new SeededRandom(DEFAULT_SEED);
  #idleTimer: ReturnType<typeof setTimeout> | undefined;
  #activePage: Page | undefined;
  #lastMouseByPage = new WeakMap<Page, {x: number; y: number}>();

  configure(config: HumanizeConfig): void {
    this.#config = config;
    this.#rng = new SeededRandom(hashSeed(config.seed));
    this.#clearIdleTimer();
    this.#ensureIdleLoop();
  }

  setActivePage(page: Page | undefined): void {
    this.#activePage = page;
    this.#ensureIdleLoop();
  }

  clearActivePage(): void {
    this.#activePage = undefined;
    this.#clearIdleTimer();
  }

  isEnabled(): boolean {
    return this.#config.enabled;
  }

  async beforeTool(): Promise<void> {
    if (!this.#config.enabled) {
      return;
    }
    await this.delayJitter(20, 120);
  }

  async afterTool(): Promise<void> {
    if (!this.#config.enabled) {
      return;
    }
    await this.delayJitter(10, 80);
    this.#ensureIdleLoop();
  }

  async delayJitter(minMs: number, maxMs: number): Promise<void> {
    if (!this.#config.enabled) {
      return;
    }
    await sleep(this.#randomInt(minMs, maxMs));
  }

  async moveMouseToElement(
    page: Page,
    element: ElementHandle,
  ): Promise<void> {
    if (!this.#config.enabled || page.isClosed()) {
      return;
    }
    const box = await element.boundingBox();
    if (!box) {
      return;
    }
    const x = box.x + box.width * this.#randomInRange(0.3, 0.7);
    const y = box.y + box.height * this.#randomInRange(0.3, 0.7);
    await this.moveMouseToPoint(page, x, y);
  }

  async moveMouseToPoint(page: Page, x: number, y: number): Promise<void> {
    if (!this.#config.enabled || page.isClosed()) {
      return;
    }
    const start = this.#lastMouseByPage.get(page) ?? {
      x: this.#randomInt(10, 200),
      y: this.#randomInt(10, 200),
    };
    await page.mouse.move(start.x, start.y);
    const steps = this.#randomInt(8, 25);
    await page.mouse.move(Math.round(x), Math.round(y), {steps});
    this.#lastMouseByPage.set(page, {x: Math.round(x), y: Math.round(y)});
  }

  async typeText(page: Page, text: string): Promise<void> {
    if (!this.#config.enabled) {
      await page.keyboard.type(text);
      return;
    }
    for (const char of text) {
      await page.keyboard.type(char, {
        delay: this.#randomInt(25, 140),
      });
      if (this.#rng.next() < 0.12) {
        await sleep(this.#randomInt(60, 180));
      }
    }
  }

  #clearIdleTimer(): void {
    if (this.#idleTimer) {
      clearTimeout(this.#idleTimer);
      this.#idleTimer = undefined;
    }
  }

  #ensureIdleLoop(): void {
    if (!this.#config.enabled || !this.#config.idleMouse || this.#idleTimer) {
      return;
    }
    this.#scheduleIdleTick();
  }

  #scheduleIdleTick(): void {
    this.#idleTimer = setTimeout(async () => {
      this.#idleTimer = undefined;
      await this.#idleTick();
      this.#ensureIdleLoop();
    }, this.#randomInt(1400, 5000));
  }

  async #idleTick(): Promise<void> {
    const page = this.#activePage;
    if (!page || page.isClosed()) {
      return;
    }
    const viewport = page.viewport() ?? {width: 1280, height: 720};
    const x = this.#randomInt(3, Math.max(4, viewport.width - 3));
    const y = this.#randomInt(3, Math.max(4, viewport.height - 3));
    await this.moveMouseToPoint(page, x, y);
  }

  #randomInRange(min: number, max: number): number {
    return min + this.#rng.next() * (max - min);
  }

  #randomInt(min: number, max: number): number {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    if (high <= low) {
      return low;
    }
    return low + Math.floor(this.#rng.next() * (high - low + 1));
  }
}

export const humanizer = new Humanizer();