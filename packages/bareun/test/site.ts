import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import config from "./cms.config";

/** The site this package's suites run against: the core package's blog config plus the Bareun checker (`cms.config.ts`). */
export const testConfig: AnyCmsConfig = config;

export const testSite = createSite(testConfig);
