/**
 * 설정 파일의 기본 내보내기를 꺼낸다. 앱이 CommonJS로 컴파일되는 곳(명령줄 도구를 `tsx`로 돌릴 때 등)에서는
 * ES 모듈인 이 패키지가 `export default` 값을 `{ default: 값 }`으로 한 번 더 감싼 채 받는다.
 */
export function unwrapDefault<T>(imported: T): T {
	const value = imported as T & { default?: T; __esModule?: boolean };
	return value && typeof value === "object" && "default" in value && value.default !== undefined
		? value.default
		: imported;
}
