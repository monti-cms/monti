import type { CmsConfig } from "../src/config/define";
import { createSite } from "../src/site";

/** The site variants a package's suites can run against (`site` of `packageTests` in `vitest.shared.ts` sets `MONTI_TEST_SITE`). */
export interface TestConfigs {
	/** The default run. */
	readonly blog: CmsConfig;
	/** `vitest.othersite.config.ts`: collections, fields, languages and blocks that differ from the blog. */
	readonly "other-site"?: CmsConfig;
	/** `vitest.configured.config.ts`: the blog with an extension switched on. */
	readonly configured?: CmsConfig;
}

/**
 * The config and site a package's suites run against, picked by `MONTI_TEST_SITE`. The config type is the loose one, so a test looks collection, field
 * and block names up from the site instead of writing them; a test that asserts one config as is imports that config file itself.
 */
export function siteUnderTest(configs: TestConfigs) {
	const variant = process.env.MONTI_TEST_SITE as keyof TestConfigs | undefined;
	const testConfig: CmsConfig = (variant && configs[variant]) || configs.blog;
	return { testConfig, testSite: createSite(testConfig) };
}
