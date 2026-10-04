// Build only: placeholder for the app's site config. The emitted code imports `@cms-config` as is, and the app links it to its own config file.
import type { CmsConfig } from "../src/config/define";

declare const config: CmsConfig;
export default config;
