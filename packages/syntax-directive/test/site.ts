import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import blog from "./cms.config";
import directive from "./directive.config";
import otherSite from "./other-site.config";

/**
 * The site the suites run against, chosen by `MONTI_TEST_SITE`: the core package's reference blog config (`cms.config.ts`) by default, the other-site config
 * (`other-site.config.ts`, `vitest.othersite.config.ts`) with `other-site`, and the blog config with the directive extension switched on (`directive.config.ts`,
 * `vitest.configured.config.ts`) with `configured`. A test that asserts the blog config as is is named `*.blog.test.ts`.
 */
const CONFIGS: Readonly<Record<string, AnyCmsConfig>> = { "other-site": otherSite, configured: directive };

export const testConfig: AnyCmsConfig = CONFIGS[process.env.MONTI_TEST_SITE ?? ""] ?? blog;

export const testSite = createSite(testConfig);
