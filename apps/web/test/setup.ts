/**
 * Global Vitest setup for the web app's jsdom test environment.
 *
 * - Registers @testing-library/jest-dom custom matchers (e.g. `toBeInTheDocument`).
 * - Unmounts React trees and resets the DOM after every test so suites stay
 *   isolated.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
