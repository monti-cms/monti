import { type OperationSpec, specOf } from "@monti-cms/core";
import { withMonti } from "../boot/connect";
import { loadEnv } from "../boot/env";
import type { LoadedProject } from "../migrate/runner";
import type { ParsedArgs } from "../parse/args";
import { CliUsageError } from "../parse/error";
import { formatOperationHelp, formatResourceHelp } from "../parse/help";
import { buildOperationInput } from "../parse/input";
import { requiredProperties } from "../parse/json-schema";
import { writeJson } from "./output";
import { loadProject } from "./project";
import type { CliIo } from "./types";

/** 비어 있으면 대화형 터미널에서 숨김 입력으로 묻는 민감 필드. */
const secretFields = new Set(["password", "currentPassword", "secret", "token"]);

/** `monti spec`: DB 없이 core와 설정의 플러그인이 가진 모든 작업의 명세를 JSON으로 쓴다. */
export async function printSpec(parsed: ParsedArgs, io: CliIo): Promise<void> {
	if (parsed.dryRun) throw new CliUsageError("spec에는 --dry-run을 쓸 수 없다");
	const { config } = await loadProject(parsed, io);
	writeJson(io, specOf(config.plugins));
}

/**
 * `monti <resource> [<action>]`: 작업 이름이 없으면 리소스 도움말을, `--help`이면 작업 도움말을 DB 없이 쓰고, 아니면 작업을
 * 실행한다. core와 플러그인에 없는 리소스나 작업이면 사용법 오류다.
 */
export async function runOperation(parsed: ParsedArgs, io: CliIo): Promise<void> {
	const project = await loadProject(parsed, io);
	const specs = specOf(project.config.plugins);
	const [resource, action] = parsed.positionals;
	if (action === undefined) return io.stdout(`${resourceHelp(resource, specs)}\n`);
	const spec = specs.find((candidate) => candidate.name === `${resource}.${action}`);
	if (spec === undefined) throw unknownCommand(`${resource} ${action}`);
	if (parsed.help) return io.stdout(`${formatOperationHelp(spec)}\n`);
	await execute(spec, project, parsed, io);
}

/** `resource`의 작업 목록 도움말. core와 플러그인에 `resource`의 작업이 하나도 없으면 사용법 오류다. */
function resourceHelp(resource: string, specs: OperationSpec[]): string {
	if (!specs.some((spec) => spec.name.startsWith(`${resource}.`))) throw unknownCommand(resource);
	return formatResourceHelp(resource, specs);
}

function unknownCommand(command: string): CliUsageError {
	return new CliUsageError(`알 수 없는 명령이다: ${command}`);
}

/**
 * 작업 `spec`을 명령줄의 입력으로 실행하고 반환값을 JSON으로 쓴다. 대화형 터미널이면 비어 있는 필수 민감 필드를 먼저 묻는다.
 * 쓰기 작업의 `--dry-run`은 실행해 본 뒤 되돌리고, 읽기 작업의 `--dry-run`은 DB를 열기 전에 사용법 오류로 거절한다.
 */
async function execute(spec: OperationSpec, project: LoadedProject, parsed: ParsedArgs, io: CliIo): Promise<void> {
	if (spec.kind === "read" && parsed.dryRun) {
		throw new CliUsageError(`읽기 작업에는 --dry-run을 쓸 수 없다: ${spec.name}`);
	}
	const built = await buildOperationInput(spec, parsed.input, parsed.flags, io.readStdin);
	const input = io.isTTY ? await withSecrets(spec, built, io.promptSecret) : built;
	const env = loadEnv(io.cwd, io.env);
	const output = await withMonti({ project, env }, ({ monti }) =>
		parsed.dryRun ? monti.dryRun((tx) => call(tx, spec.name, input)) : call(monti, spec.name, input),
	);
	writeJson(io, output);
}

/**
 * `input`이 고른 입력 모양에서 필수인데 비어 있는 민감 필드를 `promptSecret`으로 물어 채운 입력. 물을 필드가 없으면 `input`
 * 그대로다(선택 필드나 다른 모양의 필드는 묻지 않는다).
 */
async function withSecrets(spec: OperationSpec, input: unknown, promptSecret: CliIo["promptSecret"]): Promise<unknown> {
	const given = { ...(input as Record<string, unknown> | undefined) };
	const missing = requiredProperties(spec.input, given).filter(
		(name) => secretFields.has(name) && given[name] === undefined,
	);
	for (const name of missing) given[name] = await promptSecret(name);
	return missing.length > 0 ? given : input;
}

/**
 * `client`(엔진, 또는 `dryRun`이 넘긴 쓰기 클라이언트)에서 이름이 `name`(`resource.action`)인 작업을 `input`으로 부른다.
 * 작업은 플러그인이 더한 것일 수 있어 타입이 아니라 이름으로 찾는다. `name`은 `specOf`에서 찾은 이름이라 반드시 있다.
 */
function call(client: object, name: string, input: unknown): Promise<unknown> {
	const [resource, action] = name.split(".");
	return Reflect.get(Reflect.get(client, resource), action)(input);
}
