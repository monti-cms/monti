import { describe, expect, it, vi } from "vitest";

// 사이트 설정을 읽으면 실패한다. `postgres()`·저장소 만들기만으로는 읽지 않아야 한다(M17-3).
vi.mock("../../../config/resolved", () => {
	throw new Error("site config was loaded");
});

describe("postgres() 지연 불러오기", () => {
	it("어댑터를 만들고 저장소를 꺼내도 저장소 모듈·사이트 설정을 불러오지 않는다", async () => {
		const { postgres } = await import("../adapter");
		const adapter = postgres({ connectionString: "postgres://localhost/none" });
		const store = adapter.createStore();
		expect(typeof store.getEntry).toBe("function");
		// 함수를 부르는 순간 저장소 모듈을 불러온다(여기서는 설정을 막아 두어 실패한다).
		await expect(store.getEntry("x")).rejects.toThrow(/site config was loaded|error when mocking/);
		await adapter.close?.();
	});

	it("서버 설정이 쓰는 로그인·파일 저장소 어댑터도 사이트 설정을 불러오지 않는다", async () => {
		const { githubAuth } = await import("../../auth/github");
		const { r2Storage } = await import("../../../storage/s3");
		const auth = githubAuth({ clientId: "id", clientSecret: "secret", adminIds: ["1"] }).create({
			loginPath: "/admin/login",
		});
		expect(auth.providers?.[0]?.label).toBeTruthy();
		expect(() =>
			r2Storage({
				accessKeyId: "a",
				secretAccessKey: "b",
				bucket: "c",
				endpoint: "https://example.com",
				publicBaseUrl: "https://cdn.example.com",
			}),
		).not.toThrow();
	});
});
