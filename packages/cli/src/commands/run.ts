import type { ErrorCode } from "@monti-cms/core";
import packageJson from "../../package.json";
import { loadEnv } from "../boot/env";
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

/** 오류 출력에서 비밀값을 바꿔 쓰는 글. */
const mask = "***";

/**
 * CLI 진입 함수: `argv`(명령 이름 뒤의 인자)를 실행하고 종료 코드를 돌려준다. 성공은 `0`, 실행 오류(core 오류, DB·파일 오류)는
 * `1`, 사용법 오류는 `2`이고, 오류는 그 메시지에서 비밀값을 가려(`redact`) `stderr`에 쓴다.
 */
export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
	try {
		await dispatch(parseArgs(argv), io);
		return 0;
	} catch (error) {
		const { exitCode, prefix, message } = describeError(error);
		io.stderr(`${prefix}${redact(message, io)}\n`);
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
 * 오류로 끝낼 종료 코드와 `stderr`에 쓸 머리말·메시지. CLI 오류는 그 종료 코드로, core 오류는 머리말 `[코드] `를 붙여, 그 밖의
 * 오류(DB·파일 오류 등)와 오류 객체가 아닌 값(`throw null` 등)은 메시지만 쓰고 `1`로 끝낸다. 비밀값은 메시지에서만 가리므로
 * (`redact`), 짧은 비밀값이 머리말의 오류 코드를 바꾸지 못한다.
 */
function describeError(error: unknown): { exitCode: number; prefix: string; message: string } {
	if (error instanceof CliError) return { exitCode: error.exitCode, prefix: "", message: error.message };
	const { code } = Object(error) as { code?: unknown };
	return { exitCode: 1, prefix: isErrorCode(code) ? `[${code}] ` : "", message: messageOf(error) };
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

/** `message`에서 비밀값(`secretsOf`)을 긴 것부터 모두 `mask`로 바꾼 글. */
function redact(message: string, io: CliIo): string {
	return secretsOf(io).reduce((text, secret) => text.replaceAll(secret, mask), message);
}

/**
 * 오류 출력에 나가면 안 되는 비밀값을 긴 것부터: 명령이 읽는 환경 변수(`loadEnv`)의 `DATABASE_URL` 비밀번호(사용자 정보 자리와
 * `?password=` 자리 모두, URL에 쓰인 그대로와 풀어 쓴 것)와 `MONTI_SECRET`. 빈 값은 뺀다. 긴 것부터 바꿔야 다른 비밀값의 일부인
 * 짧은 비밀값이 먼저 바뀌어 긴 비밀값이 가려지지 않는 일이 없다. `.env` 파일을 읽지 못하면 실행 환경 변수만 본다.
 */
function secretsOf(io: CliIo): string[] {
	const env = envOf(io);
	const url = URL.parse(env.DATABASE_URL ?? "");
	const passwords = [url?.password ?? "", rawQueryPassword(url), url?.searchParams.get("password") ?? ""];
	return [...passwords.flatMap((password) => [password, decoded(password)]), env.MONTI_SECRET ?? ""]
		.filter((secret) => secret !== "")
		.sort((a, b) => b.length - a.length);
}

/** URL의 `?password=` 값을 URL에 쓰인 그대로. 없으면 빈 글이다. */
function rawQueryPassword(url: URL | null): string {
	const pair = url?.search
		.slice(1)
		.split("&")
		.find((part) => part.startsWith("password="));
	return pair?.slice("password=".length) ?? "";
}

/** 명령이 읽는 환경 변수. 오류를 쓰는 중이므로, `.env` 파일을 읽지 못해도 던지지 않고 실행 환경 변수를 돌려준다. */
function envOf(io: CliIo): Record<string, string | undefined> {
	try {
		return loadEnv(io.cwd, io.env);
	} catch {
		return io.env;
	}
}

/** URL에 `%`로 적힌 글을 푼 것. 잘못 적혀 풀 수 없으면 그대로다. */
function decoded(text: string): string {
	try {
		return decodeURIComponent(text);
	} catch {
		return text;
	}
}
