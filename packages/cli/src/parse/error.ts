/** CLI가 던지는 오류. `exitCode`는 이 오류로 끝날 때의 종료 코드다: `1`은 실행 오류(파일·DB 등), `2`는 사용법 오류. */
export class CliError extends Error {
	constructor(
		readonly exitCode: 1 | 2,
		message: string,
	) {
		super(message);
	}
}

/** 명령이나 옵션을 잘못 쓴 사용법 오류. core를 부르기 전 파서 단계에서 잡고, 종료 코드 `2`로 끝난다. */
export class CliUsageError extends CliError {
	constructor(message: string) {
		super(2, message);
	}
}
