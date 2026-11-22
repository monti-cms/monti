import { type CoreMonti, MontiError } from "@monti-cms/core";
import { readCookie, resolveCookie } from "../protocol/cookie";
import { errorResponse, methodNotAllowedResponse, successResponse } from "../protocol/response";
import type { HttpHandler, HttpHandlerOptions, ResolvedCookie, SuccessStatus } from "../protocol/types";
import { parseInput } from "../routing/input";
import { createRouteTable, matchRoute } from "../routing/match";
import type { RouteMatch, RouteOperation, RouteTable } from "../routing/types";
import { authorize, cookieOutcome, withToken } from "./auth";

/** 한 핸들러가 모든 요청에 쓰는 것. */
interface HandlerContext {
	monti: CoreMonti;
	table: RouteTable;
	cookie: ResolvedCookie;
}

/**
 * `monti`의 모든 공개 Operation을 REST로 여는 표준 `(request) => Promise<Response>` 핸들러. 쿠키 옵션이 잘못되었으면
 * (`sameSite: "none"`과 `secure: false`) 만들 때 오류를 던진다.
 */
export function createHttpHandler(monti: CoreMonti, options: HttpHandlerOptions = {}): HttpHandler {
	const context: HandlerContext = {
		monti,
		table: createRouteTable(monti.spec(), options.basePath ?? "/api"),
		cookie: resolveCookie(options.cookie),
	};
	return async function handle(request: Request): Promise<Response> {
		try {
			return await respond(context, request);
		} catch (error) {
			return errorResponse(error);
		}
	};
}

/** 경로를 매칭해(`404`, `405`) 맞는 Operation을 실행한다. */
async function respond(context: HandlerContext, request: Request): Promise<Response> {
	const result = matchRoute(context.table, request.method, new URL(request.url).pathname);
	if (result.kind === "not_found") throw new MontiError("NOT_FOUND", "찾을 수 없는 경로다");
	if (result.kind === "method_not_allowed") return methodNotAllowedResponse(result.allow);
	return run(context, result, request);
}

/** 세션 인증 → 입력 해석 → 실행 → 쿠키 후처리 순서로 매칭된 Operation을 처리한다. */
async function run(context: HandlerContext, match: RouteMatch, request: Request): Promise<Response> {
	const { operation } = match;
	const token = readCookie(request.headers.get("cookie"), context.cookie.name);
	await authorize(context.monti, operation.name, token);
	const { input, dryRun } = await parseInput(match, request);
	if (operation.name === "session.get" && token === undefined) return successResponse(200, { admin: null });
	const output = await execute(context.monti, operation, withToken(operation.name, input, token), dryRun);
	const isHttps = new URL(request.url).protocol === "https:";
	const { body, setCookie } = cookieOutcome(operation.name, output, { cookie: context.cookie, isHttps, dryRun });
	return successResponse(statusOf(operation, output), body, setCookie);
}

/** 시험 실행이면 `monti.dryRun` 안에서, 아니면 바로 Operation을 부른다. */
function execute(monti: CoreMonti, operation: RouteOperation, input: unknown, dryRun: boolean): Promise<unknown> {
	if (!dryRun) return call(monti, operation, input);
	return monti.dryRun((tx) => call(tx, operation, input));
}

/**
 * `client`(엔진, 또는 `dryRun`이 넘긴 쓰기 클라이언트)에서 `operation`을 `input`으로 부른다. 작업은 플러그인이 더한 것일
 * 수 있어 타입이 아니라 이름으로 찾는다. 이름은 `monti.spec()`에서 온 것이라 반드시 있다.
 */
function call(client: object, operation: RouteOperation, input: unknown): Promise<unknown> {
	return Reflect.get(Reflect.get(client, operation.resource), operation.action)(input);
}

/** 반환값이 없으면 `204`, 로그인 말고 생성(`create`)이면 `201`, 그 밖은 `200`. */
function statusOf(operation: RouteOperation, output: unknown): SuccessStatus {
	if (output === undefined) return 204;
	return operation.action === "create" && operation.name !== "session.create" ? 201 : 200;
}
