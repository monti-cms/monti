import { afterEach, describe, expect, it, vi } from "vitest";
import { s3Storage } from "../index";

const S3 = {
	S3_REGION: "ap-northeast-2",
	S3_BUCKET: "b",
	S3_ACCESS_KEY_ID: "k",
	S3_SECRET_ACCESS_KEY: "s",
	S3_PUBLIC_URL: "https://cdn.example.com",
};
const R2 = {
	S3_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
	S3_REGION: "auto",
	S3_BUCKET: "b",
	S3_ACCESS_KEY_ID: "k",
	S3_SECRET_ACCESS_KEY: "s",
	S3_PUBLIC_URL: "https://cdn.example.com/",
};
const setEnv = (vars: Record<string, string>) => {
	for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
};
const ALL = [...Object.keys(S3), "S3_ENDPOINT", "S3_FORCE_PATH_STYLE"];

afterEach(() => vi.unstubAllEnvs());

describe("environment configuration", () => {
	it("creating the adapter reads nothing, so empty variables do not fail a build", () => {
		for (const key of ALL) vi.stubEnv(key, "");
		expect(() => s3Storage()).not.toThrow();
	});

	it("works with no arguments: AWS S3 from S3_*", () => {
		setEnv(S3);
		expect(s3Storage().createStore().getPublicUrl("a.png")).toBe("https://cdn.example.com/a.png");
	});

	it("Cloudflare R2 is the same function: S3_ENDPOINT and S3_REGION=auto", () => {
		setEnv(R2);
		const adapter = s3Storage();
		expect(adapter.name).toBe("s3");
		expect(adapter.createStore().getPublicUrl("media/a.png")).toBe("https://cdn.example.com/media/a.png");
	});

	it("there is no r2Storage and R2_* is not read", async () => {
		expect(await import("../index")).not.toHaveProperty("r2Storage");
		for (const key of ALL) vi.stubEnv(key, "");
		setEnv({
			R2_BUCKET: "b",
			R2_ACCOUNT_ID: "a",
			R2_ACCESS_KEY_ID: "k",
			R2_SECRET_ACCESS_KEY: "s",
			R2_PUBLIC_URL: "https://x",
		});
		expect(() => s3Storage().createStore()).toThrow("S3_ENDPOINT");
	});

	it("options override the variables, one by one or all", () => {
		setEnv(S3);
		expect(s3Storage({ publicBaseUrl: "https://other.example.com" }).createStore().getPublicUrl("a.png")).toBe(
			"https://other.example.com/a.png",
		);
		for (const key of ALL) vi.stubEnv(key, "");
		const store = s3Storage({
			endpoint: "http://localhost:9000",
			forcePathStyle: true,
			bucket: "b",
			accessKeyId: "k",
			secretAccessKey: "s",
			publicBaseUrl: "http://localhost:9000/b",
		}).createStore();
		expect(store.getPublicUrl("a.png")).toBe("http://localhost:9000/b/a.png");
	});

	it.each(
		Object.keys(S3).filter((key) => key !== "S3_REGION"),
	)("names the missing %s, where to set it and how", (key) => {
		setEnv(S3);
		vi.stubEnv(key, "");
		const message = (() => {
			try {
				s3Storage().createStore();
			} catch (error) {
				return (error as Error).message;
			}
			return "";
		})();
		expect(message).toContain(key);
		expect(message).toMatch(/Where:.*s3Storage\(\{ \w+ \}\)/);
		expect(message).toContain("Fix:");
	});

	it("needs a region or an endpoint, and names the endpoint variable", () => {
		setEnv({ ...S3, S3_REGION: "" });
		expect(() => s3Storage().createStore()).toThrow(/S3_ENDPOINT.*Where:.*s3Storage\(\{ endpoint \}\).*Fix:/s);
		expect(() => s3Storage({ endpoint: "http://localhost:9000", forcePathStyle: true }).createStore()).not.toThrow();
	});
});
