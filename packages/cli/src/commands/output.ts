import type { CliIo } from "./types";

/**
 * `value`를 JSON 하나로 `stdout`에 쓴다. 반환값이 없으면(`undefined`) `null`이다. 함수는 `JSON.stringify`처럼 빠지고, 순환
 * 참조는 그 자리를 비워 끊는다(배열 안이면 `null`).
 */
export function writeJson(io: CliIo, value: unknown): void {
	io.stdout(`${JSON.stringify(value ?? null, cutCycles(), 2)}\n`);
}

/**
 * `JSON.stringify`의 replacer: 지금 값이 그 조상(뿌리에서 지금 값까지 거쳐 온 객체) 가운데 하나이면 빼서 순환을 끊는다. 순환이
 * 아닌 공유 참조(여러 곳에서 가리키는 같은 객체)는 가리키는 곳마다 그대로 직렬화한다.
 */
function cutCycles(): (this: unknown, key: string, value: unknown) => unknown {
	/** 뿌리에서 지금 값까지 거쳐 온 값. */
	const chain: unknown[] = [];
	return function cutCycle(this: unknown, _key: string, value: unknown): unknown {
		// `this`는 지금 값을 담은 객체다. 그 뒤에 쌓인 것(앞서 끝난 형제 값의 경로)을 덜어 내면 지금 값의 조상만 남는다.
		chain.length = chain.indexOf(this) + 1;
		if (chain.includes(value)) return undefined;
		chain.push(value);
		return value;
	};
}
