import { cmsConfig } from "../config/resolved";
import type { CmsPlugin } from "./define";

/**
 * 사이트 설정(`cms.config.ts`)의 `plugins`에서 이름으로 고른 플러그인의 설정 값(`options`). 서버와 브라우저 코드가 함께 쓴다.
 * 확장이 자기 설정을 읽는 공식 방법이다. 그 플러그인이 설정에 없으면 `undefined`다.
 */
export function getPluginOptions<Options = unknown>(name: string): Options | undefined {
	// 플러그인이 없는 설정은 빈 튜플 타입이라 넓혀 읽는다.
	const plugins: readonly CmsPlugin[] = cmsConfig.plugins ?? [];
	return plugins.find((plugin) => plugin.name === name)?.options as Options | undefined;
}
