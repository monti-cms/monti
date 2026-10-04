import { defineConfig } from "@monti-cms/core";
import base from "../../core/test/cms.config";
import { bareun } from "../src/index";

/** The core package's example blog config plus the Bareun checker. Used by this package's tests. */
export default defineConfig({
	...base,
	plugins: [bareun({ apiKeyEnv: "TEST_BAREUN_KEY", label: "바른 검사", customDictNames: ["blog"] })],
});
