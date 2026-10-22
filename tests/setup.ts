import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import i18n, { languagePreferences } from '../src/i18n';

beforeEach(() => {
  void languagePreferences.setPreference('en');
});
afterEach(() => {
  void i18n.changeLanguage('en');
});
afterEach(cleanup);
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.scrollTo = vi.fn();
// jsdom omits modern Blob readers; FileReader exercises its actual Blob bytes.
if (!Blob.prototype.arrayBuffer)
  Blob.prototype.arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
