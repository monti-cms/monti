import type { OperationSpec } from "@monti-cms/core";
import { CliUsageError } from "./error";
import { propertyTypes } from "./json-schema";

/** 참거짓 속성에 글자로 준 값. */
const booleanWords = new Map([
	["true", true],
	["false", false],
]);

/**
 * 작업 입력을 만든다. `--input`이 있으면 그 JSON(`-`이면 표준 입력에서 읽은 JSON)을 그대로 쓰고, 없으면 개별 옵션을
 * `spec.input`의 속성 타입에 맞춰 바꾼 객체를 만든다. 둘 다 없으면 입력 없이 부르도록 `undefined`다. 둘을 함께 주면
 * 어느 쪽이 입력인지 모호하므로 사용법 오류다.
 */
export async function buildOperationInput(
	spec: OperationSpec,
	inputFlag: string | undefined,
	flags: Record<string, string | boolean>,
	readStdin: () => Promise<string>,
): Promise<unknown> {
	const names = Object.keys(flags);
	if (inputFlag !== undefined && names.length > 0) throw new CliUsageError("--input과 개별 옵션을 함께 쓸 수 없다");
	if (inputFlag !== undefined) return parseJson(inputFlag === "-" ? await readStdin() : inputFlag);
	if (names.length === 0) return undefined;
	return Object.fromEntries(names.map((name) => [name, scalarOf(name, flags[name], propertyTypes(spec.input, name))]));
}

/** `--input`의 JSON. 문법이 틀리면 사용법 오류다. */
function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		throw new CliUsageError("--input의 JSON 문법이 틀렸다");
	}
}

/**
 * 개별 옵션 값 하나를 속성이 받는 타입에 맞춘다. 글자를 받는 속성은 그대로 두고, 글자를 받지 않는 숫자·참거짓 속성만
 * 바꾼다. 값 없이 쓴 옵션(`true`)은 참거짓 속성에만 쓸 수 있다. 그 밖의 검사는 core의 입력 검사가 맡는다.
 */
function scalarOf(name: string, value: string | boolean, types: Set<string>): unknown {
	if (typeof value === "boolean") {
		if (types.has("boolean")) return value;
		throw new CliUsageError(`--${name} 뒤에 값이 없다`);
	}
	if (types.has("string")) return value;
	if (types.has("number") || types.has("integer")) return numberOf(name, value);
	if (types.has("boolean")) return booleanOf(name, value);
	return value;
}

/** 숫자 속성에 준 글자를 숫자로 바꾼다. 빈 글자이거나 유한한 숫자가 아니면 사용법 오류다. */
function numberOf(name: string, raw: string): number {
	const number = Number(raw);
	if (raw.trim() === "" || !Number.isFinite(number)) throw new CliUsageError(`--${name}에는 숫자를 넣어야 한다`);
	return number;
}

/** 참거짓 속성에 준 글자(`true`·`false`)를 참거짓으로 바꾼다. 다른 글자면 사용법 오류다. */
function booleanOf(name: string, raw: string): boolean {
	const value = booleanWords.get(raw);
	if (value === undefined) throw new CliUsageError(`--${name}에는 true나 false를 넣어야 한다`);
	return value;
}
