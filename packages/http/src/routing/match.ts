import { MontiError, type OperationSpec } from "@monti-cms/core";
import { hasIdBranch, hasNoIdBranch } from "./schema";
import type { HttpMethod, RouteOperation, RouteResult, RouteTable } from "./types";

/** 표준 동사. 이 이름의 Operation은 `POST /<resource>/<action>` 액션 경로로 부를 수 없다. */
const STANDARD_VERBS = new Set(["list", "get", "create", "update", "delete"]);

/** `Allow` 헤더에 메서드를 싣는 순서. */
const METHOD_ORDER: HttpMethod[] = ["GET", "POST", "PATCH", "DELETE"];

const NOT_FOUND: RouteResult = { kind: "not_found" };

/** 한 경로에서 메서드마다 열린 Operation. 열리지 않은 메서드는 `undefined`다. */
type Routes = Map<string, RouteOperation | undefined>;

/** 명세 `specs`를 리소스·액션 이름으로 나눈 라우트 테이블. `basePath`의 끝 슬래시는 뗀다(`"/"`는 루트 `""`). */
export function createRouteTable(specs: OperationSpec[], basePath: string): RouteTable {
	const resources = new Map<string, Map<string, RouteOperation>>();
	for (const spec of specs) {
		const [resource, action] = spec.name.split(".");
		const actions = resources.get(resource) ?? new Map<string, RouteOperation>();
		actions.set(action, { ...spec, resource, action });
		resources.set(resource, actions);
	}
	return { basePath: basePath.replace(/\/$/, ""), resources };
}

/**
 * 요청 메서드와 경로(`URL.pathname`)에 맞는 Operation. 경로가 다른 메서드로만 열려 있으면 `method_not_allowed`와 허용
 * 메서드를, 어떤 메서드로도 열려 있지 않으면 `not_found`를 돌려준다. 퍼센트 인코딩이 잘못된 세그먼트는 `BAD_REQUEST`다.
 */
export function matchRoute(table: RouteTable, method: string, pathname: string): RouteResult {
	const segments = segmentsOf(pathname, table.basePath);
	const actions = table.resources.get(segments[0]);
	if (actions === undefined || segments.length > 2) return NOT_FOUND;
	const [, member] = segments;
	const normalized = method.toUpperCase();
	const routes = member === undefined ? collectionRoutes(actions) : memberRoutes(actions, member);
	const operation = routes.get(normalized);
	if (operation !== undefined) return { kind: "match", operation, id: normalized === "POST" ? undefined : member };
	const allow = METHOD_ORDER.filter((candidate) => routes.get(candidate) !== undefined);
	return allow.length === 0 ? NOT_FOUND : { kind: "method_not_allowed", allow };
}

/**
 * `basePath` 뒤의 디코딩한 경로 세그먼트들. 끝 슬래시는 뗀다. 경로가 `basePath` 밖이면 비어 있고, `basePath` 자신이면 빈
 * 세그먼트 하나라 어느 리소스에도 맞지 않는다.
 */
function segmentsOf(pathname: string, basePath: string): string[] {
	if (!pathname.startsWith(`${basePath}/`)) return [];
	return pathname
		.slice(basePath.length + 1)
		.replace(/\/$/, "")
		.split("/")
		.map(decodeSegment);
}

function decodeSegment(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		throw new MontiError("BAD_REQUEST", `경로의 퍼센트 인코딩이 잘못되었다: ${segment}`);
	}
}

/** `/<resource>` 경로: 읽기 목록(없으면 읽기 단일 리소스 조회), 생성, `id` 없는 분기의 수정·삭제. */
function collectionRoutes(actions: Map<string, RouteOperation>): Routes {
	return new Map([
		["GET", readOnly(actions.get("list")) ?? opened(readOnly(actions.get("get")), hasNoIdBranch)],
		["POST", actions.get("create")],
		["PATCH", opened(actions.get("update"), hasNoIdBranch)],
		["DELETE", opened(actions.get("delete"), hasNoIdBranch)],
	]);
}

/** `/<resource>/<member>` 경로: 읽기 `id` 조회, `id` 수정·삭제, 또는 표준 동사가 아닌 고유 액션. */
function memberRoutes(actions: Map<string, RouteOperation>, member: string): Routes {
	return new Map([
		["GET", opened(readOnly(actions.get("get")), hasIdBranch)],
		["POST", STANDARD_VERBS.has(member) ? undefined : actions.get(member)],
		["PATCH", opened(actions.get("update"), hasIdBranch)],
		["DELETE", opened(actions.get("delete"), hasIdBranch)],
	]);
}

/** `GET`에 쓰기 Operation이 실수로 열리지 않도록 읽기 Operation만 통과시킨다. */
function readOnly(operation: RouteOperation | undefined): RouteOperation | undefined {
	return operation !== undefined && operation.kind === "read" ? operation : undefined;
}

/** 입력 스키마가 `accepts`를 만족할 때만 그 경로에 여는 Operation. */
function opened(
	operation: RouteOperation | undefined,
	accepts: (schema: Record<string, unknown>) => boolean,
): RouteOperation | undefined {
	return operation !== undefined && accepts(operation.input) ? operation : undefined;
}
