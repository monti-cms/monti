import { type OperationSpec, specOf } from "@monti-cms/core";
import { expect, it } from "vitest";
import { parseArgs } from "./args";
import { formatGlobalHelp, formatOperationHelp, formatResourceHelp } from "./help";
import { buildOperationInput } from "./input";

/** 플러그인 없이 모은 core 작업 명세. */
const specs = specOf();

/** `specs`에서 이름이 `name`인 작업 명세. */
function specNamed(name: string): OperationSpec {
	const spec = specs.find((candidate) => candidate.name === name);
	if (spec === undefined) throw new Error(`${name} 작업 명세가 없다`);
	return spec;
}

/** 글자(`key`), 빈 값(`null`)도 받는 숫자(`width`), 참거짓(`all`) 속성을 받는 작업 명세. zod가 만드는 JSON Schema 모양이다. */
const scalarSpec: OperationSpec = {
	name: "media.resize",
	kind: "write",
	input: {
		type: "object",
		properties: {
			key: { type: "string" },
			width: { anyOf: [{ type: "integer", exclusiveMinimum: 0 }, { type: "null" }] },
			all: { type: "boolean" },
		},
	},
};

/** 숫자(`number`) 속성 `width`를 받는 작업 명세. */
const numberSpec: OperationSpec = {
	name: "media.resize",
	kind: "write",
	input: { type: "object", properties: { width: { type: "number" } } },
};

/** 표준 입력을 읽지 않는 해석에 넘기는 표준 입력: 비어 있다. */
async function noStdin(): Promise<string> {
	return "";
}

/** `words` 가운데 `text`에 들어 있지 않은 것. */
function missingFrom(text: string, words: string[]): string[] {
	return words.filter((word) => !text.includes(word));
}

it("CLI-PRS-1 `--config`, `--schema`, `--migrations`, `--dry-run` 같은 전역 옵션과 실행할 명령을 분리한다", () => {
	const parsed = parseArgs([
		"--dry-run",
		"entries",
		"--config",
		"app/monti.config.ts",
		"list",
		"--collection",
		"posts",
		"--schema",
		"app/monti.schema.ts",
		"--migrations",
		"db/migrations",
	]);
	// CLI-PRS-1.1
	expect(parsed).toMatchObject({
		config: "app/monti.config.ts",
		schema: "app/monti.schema.ts",
		migrations: "db/migrations",
		dryRun: true,
	});
	// CLI-PRS-1.2
	expect({ positionals: parsed.positionals, flags: parsed.flags }).toEqual({
		positionals: ["entries", "list"],
		flags: { collection: "posts" },
	});
});

it("CLI-PRS-2 `--input`으로 JSON 문자열이나 표준 입력(`--input -`)을 넘겨 명령 입력 전체를 만든다", async () => {
	const json = '{"collection":"posts","status":"draft"}';
	const spec = specNamed("entries.list");
	const fromFlag = await buildOperationInput(spec, json, {}, noStdin);
	const fromStdin = await buildOperationInput(spec, "-", {}, async () => json);
	// CLI-PRS-2.1
	expect([fromFlag, fromStdin]).toEqual([
		{ collection: "posts", status: "draft" },
		{ collection: "posts", status: "draft" },
	]);
});

it("CLI-PRS-3 `--key value`·`--flag` 옵션을 작업 명세의 타입(글자·숫자·참거짓)에 맞게 변환한다", async () => {
	const { flags } = parseArgs(["--all", "--key", "abc", "--width", "800"]);
	const input = await buildOperationInput(scalarSpec, undefined, flags, noStdin);
	// CLI-PRS-3.1
	expect(input).toEqual({ key: "abc", width: 800, all: true });
});

it("CLI-PRS-4 `--help`로 전체 도움말과 특정 리소스·작업의 도움말을 만든다", () => {
	const global = formatGlobalHelp();
	const resource = formatResourceHelp("entries", specs);
	const operation = formatOperationHelp(specNamed("entries.create"));
	// CLI-PRS-4.1
	expect(
		missingFrom(global, [
			"--config",
			"--schema",
			"--migrations",
			"--help",
			"--version",
			"migrate",
			"spec",
			"clean-files",
		]),
	).toEqual([]);
	// CLI-PRS-4.2
	expect(missingFrom(resource, ["list", "create"])).toEqual([]);
	// CLI-PRS-4.3
	expect(
		missingFrom(operation, [
			"--collection",
			"--locale",
			"--slug",
			"--folder_id",
			"--fields",
			"--body",
			"--input",
			"--dry-run",
		]),
	).toEqual([]);
});

it("CLI-PRS-5 `--input`과 개별 `--key` 옵션을 함께 주면 거절한다", async () => {
	const input = buildOperationInput(specNamed("entries.list"), '{"collection":"posts"}', { locale: "ko" }, noStdin);
	// CLI-PRS-5.1
	await expect(input).rejects.toMatchObject({ exitCode: 2 });
});

it("CLI-PRS-6 `--input`의 JSON 문법이 틀리면 거절한다", async () => {
	const input = buildOperationInput(specNamed("entries.list"), "{broken", {}, noStdin);
	// CLI-PRS-6.1
	await expect(input).rejects.toMatchObject({ exitCode: 2 });
});

it("CLI-PRS-7 숫자 옵션에 숫자가 아닌 값을 주면 거절한다", async () => {
	const input = buildOperationInput(numberSpec, undefined, { width: "abc" }, noStdin);
	// CLI-PRS-7.1
	await expect(input).rejects.toMatchObject({ exitCode: 2 });
});

it("CLI-PRS-8 값이 필요한 옵션 뒤에 값이 빠졌으면 거절한다", async () => {
	// CLI-PRS-8.1
	expect(() => parseArgs(["entries", "list", "--config"])).toThrow(expect.objectContaining({ exitCode: 2 }));
	const { input, flags } = parseArgs(["entries", "list", "--collection"]);
	// CLI-PRS-8.1
	await expect(buildOperationInput(specNamed("entries.list"), input, flags, noStdin)).rejects.toMatchObject({
		exitCode: 2,
	});
});
