import { describe, expect, it, vi } from "vitest";
import { CMS_AUTH_BASE_PATH } from "../../../server/define";
import { githubAuthConfig } from "../auth-config";
import { githubAuth } from "../github";

// NextAuth 본체는 Next 서버 모듈을 읽으므로 설정 모양만 본다.
vi.mock("next-auth", () => ({ default: vi.fn() }));
vi.mock("next-auth/providers/github", () => ({ default: (options: object) => ({ id: "github", ...options }) }));

const credentials = { clientId: "id", clientSecret: "secret", adminIds: ["1"] };

describe("GitHub 로그인 경로", () => {
	it("로그인 API는 기본으로 관리자 API 아래(`/api/cms/auth`)이고, 예전 경로를 고를 수 있다", () => {
		expect(githubAuth(credentials).create({ loginPath: "/admin/login" }).basePath).toBe(CMS_AUTH_BASE_PATH);
		expect(githubAuth({ ...credentials, basePath: "/api/auth/" }).create({ loginPath: "/admin/login" }).basePath).toBe(
			"/api/auth",
		);
	});

	it("NextAuth 설정에 로그인 API 경로와 관리자 로그인 화면 주소를 넣는다", () => {
		const config = githubAuthConfig({
			clientId: "id",
			clientSecret: "secret",
			basePath: "/api/cms/auth",
			signInPage: "/studio/login",
		});
		expect(config.basePath).toBe("/api/cms/auth");
		expect(config.pages?.signIn).toBe("/studio/login");
		// 서명 값을 주지 않으면 NextAuth가 AUTH_SECRET을 읽게 비워 둔다.
		expect(config.secret).toBeUndefined();
	});

	it("로그인 서명 값을 받으면 NextAuth에 넘긴다(저장 값 암호화 키와 따로)", () => {
		const config = githubAuthConfig({
			clientId: "id",
			clientSecret: "secret",
			basePath: "/api/cms/auth",
			signInPage: "/admin/login",
			secret: "login-only",
		});
		expect(config.secret).toBe("login-only");
	});
});
