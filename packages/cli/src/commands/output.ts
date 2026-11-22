import type { CliIo } from "./types";

/**
 * `value`를 JSON 하나로 `stdout`에 쓴다. 반환값이 없거나(`undefined`) 함수 하나이면 `null`이다. 안에 든 함수는
 * `JSON.stringify`처럼 빠지고, 큰 정수(`bigint`)는 글자로 쓴다. 순환 참조는 그 자리를 비워 끊고(배열 안이면 `null`), 순환이
 * 아닌 공유 참조(여러 곳에서 가리키는 같은 객체)는 가리키는 곳마다 그대로 쓴다.
 */
export function writeJson(io: CliIo, value: unknown): void {
	io.stdout(`${JSON.stringify(value, jsonSafe(), 2) ?? "null"}\n`);
}

/**
 * `JSON.stringify`의 replacer: 지금 값의 원래 객체(`toJSON()`을 부르기 전)가 그 조상(뿌리에서 지금 값까지 거쳐 온 객체)의
 * 원래 객체 가운데 하나이면 빼서 순환을 끊고, `bigint`는 글자로 바꾼다. 원래 객체로 견주므로 `toJSON()`이 부를 때마다 새
 * 객체를 돌려줘도 순환을 알아본다.
 */
function jsonSafe(): (this: Record<string, unknown>, key: string, value: unknown) => unknown {
	/** 뿌리에서 지금 값까지 거쳐 온 값(replacer가 돌려준 것). `this`가 몇 번째 조상인지 찾는 데 쓴다. */
	const holders: unknown[] = [];
	/** `holders`의 값마다 그 원래 객체(`toJSON()`을 부르기 전). */
	const originals: unknown[] = [];
	return function replace(this: Record<string, unknown>, key: string, value: unknown): unknown {
		// `this`는 지금 값을 담은 객체다. 그 뒤에 쌓인 것(앞서 끝난 형제 값의 경로)을 덜어 내면 지금 값의 조상만 남는다.
		const depth = holders.lastIndexOf(this) + 1;
		holders.length = depth;
		originals.length = depth;
		const original = this[key];
		if (originals.includes(original)) return undefined;
		const safe = typeof value === "bigint" ? value.toString() : value;
		holders.push(safe);
		originals.push(original);
		return safe;
	};
}
