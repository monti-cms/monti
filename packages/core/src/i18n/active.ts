import { type MessageBundle, type MessageValue, type MessageVars, translate } from "./define";

/**
 * 지금 쓰는 화면 언어와 사이트가 덮어쓴 문구. 사이트 설정을 읽지 않으므로 저작 API(`cms.config.ts`가 import하는 모듈)에서도
 * 쓸 수 있다. 값은 `./index`가 불러올 때 사이트 설정에서 채운다(채우기 전에는 영어다).
 *
 * 블록 정의·줄 효과 정의처럼 설정 파일이 읽는 모듈의 이름표가 쓴다. 이름표는 글자를 읽는 때(getter)에 고르므로
 * 모듈을 불러온 순서와 상관없다.
 */

type Overrides = Readonly<Record<string, Readonly<Record<string, MessageValue>>>>;

let language = "en";
let overrides: Overrides | undefined;

/** 화면 언어와 덮어쓴 문구를 정한다(`./index`가 사이트 설정으로 부른다). */
export function setActiveLocale(next: string, nextOverrides?: Overrides): void {
	language = next;
	overrides = nextOverrides;
}

/** 지금 화면 언어(앞 부분, 예: `ko`). */
export const activeLanguage = (): string => language;

/**
 * 사전 하나의 번역 함수. 부를 때마다 지금 화면 언어로 고른다. 설정 파일이 읽는 모듈에서 쓴다(그 밖에서는 `createTranslator`).
 */
export function createActiveTranslator<K extends string>(bundle: MessageBundle<K>) {
	return (key: K, vars?: MessageVars): string => translate(bundle, language, key, vars, overrides);
}
