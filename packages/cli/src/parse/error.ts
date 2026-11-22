/** 명령이나 옵션을 잘못 쓴 사용법 오류. core를 부르기 전 파서 단계에서 잡고, 종료 코드 `2`로 끝난다. */
export class CliUsageError extends Error {
	readonly exitCode = 2;
}
