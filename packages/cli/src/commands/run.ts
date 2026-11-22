import type { ErrorCode } from "@monti-cms/core";
import packageJson from "../../package.json";
import { type ParsedArgs, parseArgs } from "../parse/args";
import { CliError } from "../parse/error";
import { formatGlobalHelp } from "../parse/help";
import { cleanFiles } from "./clean-files";
import { runMigrate } from "./migrate";
import { printSpec, runOperation } from "./operation";
import type { CliIo, Command } from "./types";

/** 내장 명령. 그 밖의 명령은 `<resource> <action>` 작업이다. */
const builtIns = new Map<string, Command>([
	["spec", printSpec],
	["migrate", runMigrate],
	["clean-files", cleanFiles],
]);

/** core의 오류 코드(`ErrorCode`) 전부. */
const errorCodes: Record<ErrorCode, true> = {
	BAD_REQUEST: true,
	UNAUTHORIZED: true,
	FORBIDDEN: true,
	NOT_FOUND: true,
	CONFLICT: true,
};

/**
 * CLI 진입 함수: `argv`(명령 이름 뒤의 인자)를 실행하고 종료 코드를 돌려준다. 성공은 `0`, 실행 오류(core 오류, DB·파일 오류)는
 * `1`, 사용법 오류는 `2`이고, 오류는 그 메시지를 `stderr`에 쓴다.
 */
export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
	try {
		await dispatch(parseArgs(argv), io);
		return 0;
	} catch (error) {
		const { exitCode, message } = describeError(error);
		io.stderr(`${message}\n`);
		return exitCode;
	}
}

/**
 * 명령을 고른다: `--version`이면 버전을, 명령이 없거나 내장 명령에 `--help`를 붙였으면 전체 도움말을 설정 파일과 DB 없이 쓴다.
 * 그 밖에는 내장 명령이면 그 명령을, 아니면 작업을 실행한다.
 */
async function dispatch(parsed: ParsedArgs, io: CliIo): Promise<void> {
	const [command] = parsed.positionals;
	const builtIn = builtIns.get(command);
	if (parsed.version) io.stdout(`${packageJson.version}\n`);
	else if (command === undefined || (parsed.help && builtIn !== undefined)) io.stdout(`${formatGlobalHelp()}\n`);
	else await (builtIn ?? runOperation)(parsed, io);
}

/**
 * 오류로 끝낼 종료 코드와 `stderr`에 쓸 메시지. CLI 오류는 그 종료 코드로, core 오류는 `[코드] 메시지`로, 그 밖의 오류(DB·파일
 * 오류 등)와 오류 객체가 아닌 값(`throw null` 등)은 메시지만 쓰고 `1`로 끝낸다.
 */
function describeError(error: unknown): { exitCode: number; message: string } {
	if (error instanceof CliError) return { exitCode: error.exitCode, message: error.message };
	const { code } = Object(error) as { code?: unknown };
	const message = messageOf(error);
	return { exitCode: 1, message: isErrorCode(code) ? `[${code}] ${message}` : message };
}

/**
 * 오류의 메시지. 메시지가 비어 있으면(여러 주소에 연결하다 모두 실패한 `AggregateError` 등) 첫 하위 오류의 메시지나 오류
 * 코드를 쓰고, 그것도 없으면(오류 객체가 아닌 값 등) 그 값을 글로 바꾼다.
 */
function messageOf(error: unknown): string {
	const { message, errors, code } = Object(error) as {
		message?: unknown;
		errors?: { message?: unknown }[];
		code?: unknown;
	};
	const text = [message, errors?.[0]?.message, code].find((part) => typeof part === "string" && part !== "");
	return typeof text === "string" ? text : String(error);
}

/**
 * `code`가 core의 오류 코드인지. 설정 파일이 불러온 core는 CLI의 core와 다른 모듈일 수 있어, `instanceof MontiError` 대신
 * 코드로 가린다. 글자가 아닌 코드나 DB 오류(`42601` 등)·Node 오류(`ENOENT` 등)의 코드는 core 오류 코드가 아니다.
 */
function isErrorCode(code: unknown): code is ErrorCode {
	return typeof code === "string" && Object.hasOwn(errorCodes, code);
}
