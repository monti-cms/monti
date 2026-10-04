import type { MessageBundle, MessageValue, MessageVars } from "@monti-cms/core";

/**
 * 사이트 설정 파일이 읽는 모듈(기능 정의·프리셋·검사)이 쓰는 문구 사전 고르기.
 *
 * 문구 사전의 `createTranslator`는 사이트 설정을 읽는다. 설정 파일이 이 플러그인을 불러오므로 그 모듈은 설정 파일이 읽는
 * 모듈 안에서 불러올 수 없다(순환). 그래서 언어와 사이트가 덮어쓴 문구를 `setMessageContext`로 나중에 받는다. 서버·브라우저의
 * 실행 쪽(`registry.ts`)이 설정을 읽은 뒤 한 번 넣는다. 넣기 전에는 영어다.
 */

type Overrides = Readonly<Record<string, Readonly<Record<string, MessageValue>>>>;

let language = "en";
let overrides: Overrides | undefined;

/** 화면 언어와 사이트가 덮어쓴 문구를 정한다. */
export function setMessageContext(next: { language: string; overrides?: Overrides }): void {
	language = next.language;
	overrides = next.overrides;
}

const fillVars = (text: string, vars: MessageVars = {}) =>
	text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));

/** 사전 하나의 번역 함수. 부를 때마다 지금 언어로 고른다(설정을 읽기 전에 만들어 둘 수 있다). */
export function lazyTranslator<K extends string>(bundle: MessageBundle<K>) {
	return (key: K, vars?: MessageVars): string => {
		const value =
			overrides?.[bundle.namespace]?.[key] ?? bundle.messages[language]?.[key] ?? bundle.messages.en[key] ?? key;
		return typeof value === "function" ? value(vars ?? {}) : fillVars(value, vars);
	};
}
