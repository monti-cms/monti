import type { NextRequest } from "next/server";
import type { z } from "zod";
import { type AuthContext, authGateway } from "../../adapters/auth";
import { HttpError, handleApiError } from "./error-handler";
import { validateSameOrigin } from "./security";

/**
 * 관리자 API 라우트의 공통 틀. 모든 관리자 요청은 서버에서 인증하고(§10.2),
 * 상태를 바꾸는 요청은 동일 출처 검사를 먼저 한다. 오류는 한 곳에서 같은 모양으로 바꾼다.
 */

type Params = Record<string, string>;
type HandlerContext<P extends Params> = { params: Promise<P> };

export interface AdminRequest<P extends Params> {
	request: NextRequest;
	params: P;
	auth: AuthContext;
}

export function adminRoute<P extends Params = Params>(
	handler: (input: AdminRequest<P>) => Promise<Response>,
): (request: NextRequest, context?: HandlerContext<P>) => Promise<Response> {
	return async (request, context) => {
		try {
			validateSameOrigin(request);
			const auth = await authGateway.verifyAdmin();
			const params = (await context?.params) ?? ({} as P);
			return await handler({ request, params, auth });
		} catch (error) {
			return handleApiError(error);
		}
	};
}

/** JSON 본문을 읽는다. 형식이 깨졌으면 400이다. 본문이 없으면 `{}`로 본다. */
export async function readJsonBody(request: NextRequest): Promise<unknown> {
	const text = await request.text();
	if (!text.trim()) return {};
	try {
		return JSON.parse(text);
	} catch {
		throw new HttpError(400, "invalid_input", "Request body is not valid JSON");
	}
}

/**
 * 변경 요청은 조회 응답의 `version`이 필요하다. 없으면 428, 서버와 다르면 저장소가 409를 던진다(§10.1).
 * 버전 누락을 형식 오류(400)보다 먼저 판정한다.
 */
export function assertVersionPresent(value: unknown): void {
	if (value === undefined || value === null || value === "") {
		throw new HttpError(428, "version_required", "expectedVersion is required");
	}
}

export function parseWith<S extends z.ZodType>(
	schema: S,
	value: unknown,
	message = "Invalid request body",
): z.output<S> {
	const parsed = schema.safeParse(value);
	if (!parsed.success) throw new HttpError(400, "invalid_input", message, parsed.error.issues);
	return parsed.data;
}

/** 본문을 읽고 버전 존재를 확인한 뒤 스키마로 검증한다. */
export async function readVersionedBody<S extends z.ZodType>(request: NextRequest, schema: S): Promise<z.output<S>> {
	const body = await readJsonBody(request);
	assertVersionPresent((body as { expectedVersion?: unknown })?.expectedVersion);
	return parseWith(schema, body);
}

/** 쿼리의 `expectedVersion`(DELETE 요청). */
export function readVersionQuery(request: NextRequest): number {
	const raw = request.nextUrl.searchParams.get("expectedVersion");
	assertVersionPresent(raw ?? undefined);
	const version = Number(raw);
	if (!Number.isInteger(version) || version <= 0) {
		throw new HttpError(400, "invalid_input", "Invalid expectedVersion");
	}
	return version;
}

/** 쿼리를 객체로 바꾼다. `arrayKeys`에 있는 키는 여러 번 쓸 수 있다. */
export function readQuery(request: NextRequest, arrayKeys: readonly string[] = []): Record<string, unknown> {
	const query: Record<string, unknown> = {};
	const params = request.nextUrl.searchParams;
	for (const key of new Set(params.keys())) {
		query[key] = arrayKeys.includes(key) ? params.getAll(key) : params.get(key);
	}
	return query;
}

export const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);
