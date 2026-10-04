import "server-only";
import { adminHref } from "@monti-cms/core/client";
import { type AuthContext, AuthError, authGateway } from "@monti-cms/core/runtime";
import type { Route } from "next";
import { redirect } from "next/navigation";

/**
 * 관리자 화면 공통 인증(§10.2). 세션이 없거나 다른 계정이면 오류 화면 대신 로그인으로 보낸다.
 * API는 같은 게이트웨이가 401/403으로 응답한다.
 */
export async function requireAdminPage(): Promise<AuthContext> {
	try {
		return await authGateway.verifyAdmin();
	} catch (error) {
		if (error instanceof AuthError) redirect(adminHref("/login") as Route);
		throw error;
	}
}
