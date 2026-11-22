import type { OperationSpec } from "@monti-cms/core";

/** REST 매핑에 쓰는 HTTP 메서드. 배열로 둘 때는 `Allow` 헤더 순서(`GET, POST, PATCH, DELETE`)를 따른다. */
export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/** 명세의 Operation 하나와, 그 이름(`resource.action`)을 나눈 리소스·액션 이름. */
export interface RouteOperation extends OperationSpec {
	resource: string;
	action: string;
}

/** `basePath`와, 리소스 이름마다 액션 이름별 Operation. */
export interface RouteTable {
	/** 끝 슬래시를 뗀 접두 경로. 루트 기준이면 `""`이다. */
	basePath: string;
	resources: Map<string, Map<string, RouteOperation>>;
}

/** 요청 경로와 메서드에 맞는 Operation. `id`는 `/<resource>/:id` 경로의 디코딩한 세그먼트다. */
export interface RouteMatch {
	kind: "match";
	operation: RouteOperation;
	id: string | undefined;
}

/** 경로 매칭 결과: 맞는 Operation, 찾을 수 없음(`404`), 다른 메서드로만 열린 경로(`405`). */
export type RouteResult = RouteMatch | { kind: "not_found" } | { kind: "method_not_allowed"; allow: HttpMethod[] };

/** 요청에서 조립한 Operation 입력과 시험 실행 여부. */
export interface ParsedInput {
	input: Record<string, unknown>;
	dryRun: boolean;
}
