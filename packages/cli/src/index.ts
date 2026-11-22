/** CLI 실행 입출력 인터페이스. 테스트에서 터미널 대신 주입할 수 있다. */
export interface CliIo {
	cwd: string;
	env: Record<string, string | undefined>;
	isTTY: boolean;
	stdout: (text: string) => void;
	stderr: (text: string) => void;
	readStdin: () => Promise<string>;
	promptSecret: (label: string) => Promise<string>;
}

/** CLI 진입 함수(1~3단계 구현 예정). */
export async function runCli(_argv: readonly string[], _io: CliIo): Promise<number> {
	return 0;
}
