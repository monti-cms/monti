import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import blog from "./cms.config";
import otherSite from "./other-site.config";

/**
 * The site the config-agnostic suites run against: the blog config plus the AI plugin (`cms.config.ts`) by default, the other-site config (`other-site.config.ts`) when
 * `MONTI_TEST_SITE=other-site` (`vitest.othersite.config.ts`). The type is the loose config, so a test looks collection, field and action names up from the site instead
 * of writing them. A test that asserts the blog config as is imports `./cms.config` itself.
 */
export const testConfig: AnyCmsConfig = process.env.MONTI_TEST_SITE === "other-site" ? otherSite : blog;

export const testSite = createSite(testConfig);
