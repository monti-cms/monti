import { afterEach } from "vitest";
import { commands } from "vitest/browser";

// A test that fails in the middle of a held drag (`dragPath` with `hold`) never lets go: the next test would start with the button down. Each
// package's browser setup imports this (not `testing/setup.ts`, which the e2e app's page loads too, outside Vitest).
afterEach(() => commands.dropPointer());
