import { defineConfig } from "@monti-cms/core";
import { aiPlugin } from "../../ai/src";
import base from "../../core/test/cms.config";
import { seo } from "../src";

/** 본체 패키지의 예시 블로그 설정(SEO 필드는 `seoFields`)에 SEO·AI 플러그인을 더한 설정. SEO 확장 테스트가 쓴다. */
export default defineConfig({
	...base,
	plugins: [seo(), aiPlugin({ siteDescription: "개인 기술 블로그" })],
});
