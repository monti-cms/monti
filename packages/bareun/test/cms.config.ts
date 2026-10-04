import { defineConfig } from "@monti-cms/core";
import base from "../../core/test/cms.config";
import { bareun } from "../src/index";

/** 본체 패키지의 예시 블로그 설정에 바른 검사기를 더한 설정. 이 패키지의 테스트가 쓴다. */
export default defineConfig({
	...base,
	plugins: [bareun({ apiKeyEnv: "TEST_BAREUN_KEY", label: "바른 검사", customDictNames: ["blog"] })],
});
