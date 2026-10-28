import { vi } from "vitest";

/**
 * The toast of `@monti-cms/ui` as a spy, for a test that looks at what the screen told the person. A test file mocks the module with
 * `vi.mock("@monti-cms/ui", async (importOriginal) => withToast(await importOriginal()))`, written there because `vi.mock` is hoisted per file, and reads
 * `toast` from here: the same instance, since both resolve this module once per test file.
 */
export const toast = Object.assign(vi.fn(), { error: vi.fn() });

/** The module with its `toast` replaced by {@link toast}. */
export const withToast = <T extends object>(ui: T): T => ({ ...ui, toast });
