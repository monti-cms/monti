import { MontiError } from "@monti-cms/core";
import { typesAt } from "./schema";
import type { ParsedInput, RouteMatch, RouteOperation } from "./types";

/** 쿼리에서 시험 실행 여부로 소비하는 예약 키. Operation 입력에는 넘기지 않는다. */
const DRY_RUN = "dryRun";

/** 점 표기 쿼리 키에 쓸 수 없는 세그먼트: 입력 객체의 프로토타입을 바꿀 수 있다. */
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

/** 요청 본문의 최대 크기: UTF-8 바이트로 1 MiB. */
const MAX_BODY_BYTES = 1_048_576;

/** 본문이 허용 크기를 넘은 요청의 오류. 응답 층이 `code`를 보고 `413`으로 바꾼다. */
class PayloadTooLargeError extends Error {
	readonly code = "PAYLOAD_TOO_LARGE";
}

/**
 * 요청의 Operation 입력과 시험 실행 여부. `GET`은 쿼리를, 쓰기 메서드는 JSON 본문을 입력으로 삼고, 경로 `:id`가 있으면
 * 그것이 쿼리·본문의 `id`보다 우선한다. 잘못된 `dryRun`, 쓰기 요청의 다른 쿼리 키, 잘못된 본문은 `BAD_REQUEST`다.
 */
export async function parseInput(match: RouteMatch, request: Request): Promise<ParsedInput> {
	const query = new URL(request.url).searchParams;
	const dryRun = dryRunOf(query, match.operation);
	const input = request.method === "GET" ? queryInput(query, match.operation.input) : await bodyInput(request, query);
	return { input: match.id === undefined ? input : { ...input, id: match.id }, dryRun };
}

function badRequest(message: string): MontiError {
	return new MontiError("BAD_REQUEST", message);
}

/** `?dryRun`의 값: 없거나 `false`면 일반 실행, `true`면 시험 실행이다. 중복 지정과 읽기 시험 실행은 거절한다. */
function dryRunOf(query: URLSearchParams, operation: RouteOperation): boolean {
	const values = query.getAll(DRY_RUN);
	if (values.length > 1) throw badRequest("dryRun은 한 번만 지정할 수 있다");
	const [value] = values;
	if (value === undefined || value === "false") return false;
	if (value !== "true") throw badRequest("dryRun은 true나 false만 쓸 수 있다");
	if (operation.kind === "read") throw badRequest(`읽기 작업은 시험 실행할 수 없다: ${operation.name}`);
	return true;
}

/** `GET` 쿼리를 입력 객체로: 점 표기 키는 중첩 객체로, 값은 입력 스키마의 속성 타입에 맞춰 바꾼다. */
function queryInput(query: URLSearchParams, schema: Record<string, unknown>): Record<string, unknown> {
	const input: Record<string, unknown> = {};
	for (const key of new Set(query.keys())) {
		if (key === DRY_RUN) continue;
		const path = key.split(".");
		if (path.some((segment) => FORBIDDEN_SEGMENTS.has(segment))) throw badRequest(`쓸 수 없는 쿼리 키다: ${key}`);
		setAt(input, path, converted(query.getAll(key), typesAt(schema, path)));
	}
	return input;
}

/** `target`의 점 표기 경로 `path`에 `value`를 넣는다. 자체 속성만 따라가며 스칼라·객체 충돌은 `BAD_REQUEST`다. */
function setAt(target: Record<string, unknown>, path: string[], value: unknown): void {
	let node = target;
	for (const key of path.slice(0, -1)) {
		if (!Object.hasOwn(node, key)) node[key] = {};
		const next = node[key];
		if (!isPlainObject(next)) throw badRequest(`쿼리 키가 충돌한다: ${path.join(".")}`);
		node = next;
	}
	const last = path[path.length - 1];
	if (Object.hasOwn(node, last)) throw badRequest(`쿼리 키가 충돌한다: ${path.join(".")}`);
	node[last] = value;
}

/**
 * 쿼리 값을 속성 타입 `types`에 맞춰 바꾼다: 배열은 모든 값을, `null`·참거짓·유한한 숫자는 그 값을. 바꿀 수 없으면 첫
 * 값을 글자 그대로 두어 core 검증이 거절하게 한다.
 */
function converted(values: string[], types: Set<unknown>): unknown {
	if (types.has("array")) return values;
	const [value] = values;
	if (types.has("null") && value === "null") return null;
	if (types.has("boolean") && (value === "true" || value === "false")) return value === "true";
	if ((types.has("number") || types.has("integer")) && value.trim() !== "" && Number.isFinite(Number(value))) {
		return Number(value);
	}
	return value;
}

/**
 * 쓰기 요청의 JSON 본문. 쿼리에는 `dryRun`만 쓸 수 있다. 빈 본문은 `{}`이고, 그 밖에는 `Content-Type`이
 * `application/json`이고 최상위가 객체인 JSON이어야 한다.
 */
async function bodyInput(request: Request, query: URLSearchParams): Promise<Record<string, unknown>> {
	if ([...query.keys()].some((key) => key !== DRY_RUN))
		throw badRequest("쓰기 요청에는 dryRun 말고 쿼리를 붙일 수 없다");
	const text = await readBody(request);
	if (text === "") return {};
	const mediaType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
	if (mediaType !== "application/json") throw badRequest("본문은 Content-Type: application/json이어야 한다");
	return jsonObject(text);
}

/**
 * 본문을 조각마다 세며 읽어 UTF-8로 푼다. `Content-Length`와 관계없이 읽은 바이트가 허용 크기를 넘는 순간 스트림을
 * 취소하고 `PAYLOAD_TOO_LARGE`를 던진다. 큰 본문을 다 받아 두지 않는다.
 */
async function readBody(request: Request): Promise<string> {
	const reader = request.body?.getReader();
	if (reader === undefined) return "";
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
		size += chunk.value.byteLength;
		if (size > MAX_BODY_BYTES) {
			await reader.cancel();
			throw new PayloadTooLargeError("본문이 허용 크기(1 MiB)를 넘는다");
		}
		chunks.push(chunk.value);
	}
	return new Blob(chunks).text();
}

function jsonObject(text: string): Record<string, unknown> {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		throw badRequest("본문이 올바른 JSON이 아니다");
	}
	if (!isPlainObject(value)) throw badRequest("본문의 최상위 값은 객체여야 한다");
	return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
