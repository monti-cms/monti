import { CliUsageError } from "./error";

/** 명령줄을 나눈 결과: 전역 옵션, 위치 인자(명령), 작업에 넘길 개별 옵션. */
export interface ParsedArgs {
	config?: string;
	schema?: string;
	migrations?: string;
	input?: string;
	dryRun: boolean;
	help: boolean;
	version: boolean;
	positionals: string[];
	flags: Record<string, string | boolean>;
}

/** 값을 받는 전역 옵션과 그 값을 담는 자리. */
const valueOptions = new Map<string, "config" | "schema" | "migrations" | "input">([
	["--config", "config"],
	["--schema", "schema"],
	["--migrations", "migrations"],
	["--input", "input"],
]);

/** 값 없이 켜는 전역 옵션과 그 자리. */
const switchOptions = new Map<string, "dryRun" | "help" | "version">([
	["--dry-run", "dryRun"],
	["--help", "help"],
	["-h", "help"],
	["--version", "version"],
	["-v", "version"],
]);

/**
 * 명령줄 인자를 전역 옵션, 위치 인자, 개별 옵션으로 나눈다. 전역 옵션은 어느 자리에 와도 되고, 이름이 같은 작업 속성보다
 * 앞선다. 값을 받는 전역 옵션 뒤에 값이 없으면 사용법 오류다. 개별 옵션 `--key` 뒤에 값이 없으면(인자가 끝났거나 다음이
 * 다른 옵션) `true`로 두고, 그 속성이 값 없이 쓸 수 있는 참거짓인지는 입력 변환이 가린다.
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
	const parsed: ParsedArgs = { dryRun: false, help: false, version: false, positionals: [], flags: {} };
	let index = 0;
	while (index < argv.length) index = readToken(parsed, argv, index);
	return parsed;
}

/** `argv[index]`를 `parsed`에 담고, 그 토큰이 가져간 값까지 지나 다음에 읽을 위치를 돌려준다. */
function readToken(parsed: ParsedArgs, argv: readonly string[], index: number): number {
	const token = argv[index];
	const value = valueAfter(argv, index);
	const valueKey = valueOptions.get(token);
	if (valueKey !== undefined) {
		if (value === undefined) throw new CliUsageError(`${token} 뒤에 값이 없다`);
		parsed[valueKey] = value;
		return index + 2;
	}
	const switchKey = switchOptions.get(token);
	if (switchKey !== undefined) {
		parsed[switchKey] = true;
		return index + 1;
	}
	if (!token.startsWith("--")) {
		parsed.positionals.push(token);
		return index + 1;
	}
	parsed.flags[token.slice(2)] = value ?? true;
	return value === undefined ? index + 1 : index + 2;
}

/** `argv[index]` 다음 토큰이 옵션 값이면 그 값. 인자가 끝났거나 다음이 다른 옵션(`--`로 시작)이면 `undefined`다. */
function valueAfter(argv: readonly string[], index: number): string | undefined {
	const next = argv[index + 1];
	return next === undefined || next.startsWith("--") ? undefined : next;
}
