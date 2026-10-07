import { S3Client } from "@aws-sdk/client-s3";
import type { CheckOutcome, DoctorCheck } from "@monti-cms/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { s3Storage } from "../index";

/** The checks of the S3 storage, run the way `monti doctor` runs them. */

afterEach(() => vi.restoreAllMocks());

const R2 = {
	S3_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
	S3_REGION: "auto",
	S3_BUCKET: "media",
	S3_ACCESS_KEY_ID: "key-id",
	S3_SECRET_ACCESS_KEY: "key-secret",
	S3_PUBLIC_URL: "https://cdn.example.com",
};

const checks = (options: Parameters<typeof s3Storage>[0] = {}) => s3Storage(options).checks as readonly DoctorCheck[];

const run = (
	id: string,
	env: Record<string, string | undefined>,
	options?: Parameters<typeof s3Storage>[0],
	online = false,
): Promise<CheckOutcome> => {
	const check = checks(options).find((item) => item.id === id);
	if (!check) throw new Error(`no check ${id}`);
	return Promise.resolve(check.run({ cms: {} as never, cwd: "/app", env, online }));
};

describe("storage-s3 checks for monti doctor", () => {
	it("lists a settings check and a bucket check that needs the network", () => {
		expect(checks().map((check) => [check.id, check.online ?? false])).toEqual([
			["settings", false],
			["bucket", true],
		]);
	});

	it("passes with a full set of values", async () => {
		const result = await run("settings", R2);
		expect(result.status).toBe("ok");
		expect(result.message).toContain('bucket "media"');
		expect(result.message).toContain("https://cdn.example.com");
		expect(JSON.stringify(result)).not.toContain("key-secret");
	});

	it("names every S3_ value that is missing, where to set it and an example per service", async () => {
		const result = await run("settings", {});
		expect(result.status).toBe("fail");
		for (const name of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_URL"]) {
			expect(result.message).toContain(name);
		}
		expect(result.where).toContain(".env.local");
		expect(result.fix).toContain("S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com");
		expect(result.fix).toContain("MinIO");
	});

	it("takes the endpoint from the region for AWS S3, and accepts options in place of variables", async () => {
		expect((await run("settings", { ...R2, S3_ENDPOINT: "", S3_REGION: "ap-northeast-2" })).message).toContain(
			"s3.ap-northeast-2.amazonaws.com",
		);
		expect(
			(
				await run(
					"settings",
					{},
					{
						...Object.fromEntries([
							["endpoint", R2.S3_ENDPOINT],
							["region", "auto"],
							["bucket", "b"],
							["accessKeyId", "k"],
							["secretAccessKey", "s"],
							["publicBaseUrl", R2.S3_PUBLIC_URL],
						]),
					},
				)
			).status,
		).toBe("ok");
	});

	it("catches an address without a scheme, an R2 region that is not auto, and MinIO without path-style URLs", async () => {
		expect((await run("settings", { ...R2, S3_PUBLIC_URL: "cdn.example.com" })).message).toContain("S3_PUBLIC_URL");
		expect((await run("settings", { ...R2, S3_ENDPOINT: "acct.r2.cloudflarestorage.com" })).where).toBe("S3_ENDPOINT");
		const region = await run("settings", { ...R2, S3_REGION: "us-east-1" });
		expect(region.status).toBe("warn");
		expect(region.fix).toBe("set S3_REGION=auto for R2");
		const minio = await run("settings", { ...R2, S3_ENDPOINT: "http://localhost:9000", S3_REGION: "us-east-1" });
		expect(minio.status).toBe("warn");
		expect(minio.fix).toBe("set S3_FORCE_PATH_STYLE=true");
		expect(
			(await run("settings", { ...R2, S3_ENDPOINT: "http://localhost:9000", S3_FORCE_PATH_STYLE: "true" })).status,
		).toBe("ok");
	});

	describe("bucket access (online)", () => {
		const answer = (error: Record<string, unknown> | undefined) =>
			vi.spyOn(S3Client.prototype, "send").mockImplementation((async () => {
				if (error) throw Object.assign(new Error(String(error.message ?? error.name)), error);
				return {};
			}) as never);

		it("is skipped as long as the settings are incomplete", async () => {
			const send = answer(undefined);
			expect((await run("bucket", {}, undefined, true)).status).toBe("skip");
			expect(send).not.toHaveBeenCalled();
		});

		it("passes when the bucket answers", async () => {
			answer(undefined);
			expect(await run("bucket", R2, undefined, true)).toMatchObject({
				status: "ok",
				message: expect.stringContaining('"media"'),
			});
		});

		it.each([
			[{ name: "NotFound", $metadata: { httpStatusCode: 404 } }, "does not exist", "S3_BUCKET"],
			[{ name: "Forbidden", $metadata: { httpStatusCode: 403 } }, "refused the keys", "S3_ACCESS_KEY_ID"],
			[{ name: "PermanentRedirect", $metadata: { httpStatusCode: 301 } }, "another region", "S3_REGION"],
			[{ name: "Error", code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND acct" }, "cannot be reached", "S3_ENDPOINT"],
		])("explains %j", async (error, message, where) => {
			answer(error);
			const result = await run("bucket", R2, undefined, true);
			expect(result.status).toBe("fail");
			expect(result.message).toContain(message);
			expect(result.where).toContain(where);
			expect(result.fix).toBeTruthy();
			expect(JSON.stringify(result)).not.toContain("key-secret");
		});
	});
});
