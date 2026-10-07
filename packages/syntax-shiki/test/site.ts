import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import blog from "./cms.config";
import shiki from "./shiki.config";

/**
 * The site the suites run against, chosen by `MONTI_TEST_SITE`: the core package's reference blog config (`cms.config.ts`) by default, and the blog config with
 * the Shiki notation extension and a `focus` line effect switched on (`shiki.config.ts`, `vitest.configured.config.ts`) with `configured`.
 */
export const testConfig: AnyCmsConfig = process.env.MONTI_TEST_SITE === "configured" ? shiki : blog;

export const testSite = createSite(testConfig);
