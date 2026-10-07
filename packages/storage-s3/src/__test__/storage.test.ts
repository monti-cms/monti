import { afterEach, describe, expect, it, vi } from "vitest";
import { r2Storage, s3Storage } from "../index";

const R2 = {
	R2_ACCOUNT_ID: "acct",
	R2_BUCKET: "b",
	R2_ACCESS_KEY_ID: "k",
	R2_SECRET_ACCESS_KEY: "s",
	R2_PUBLIC_URL: "https://cdn.example.com/",
};
const S3 = {
	S3_REGION: "ap-northeast-2",
	S3_BUCKET: "b",
	S3_ACCESS_KEY_ID: "k",
	S3_SECRET_ACCESS_KEY: "s",
	S3_PUBLIC_URL: "https://cdn.example.com",
};
const setEnv = (vars: Record<string, string>) => {
	for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
};
const ALL = [...Object.keys(R2), ...Object.keys(S3), "R2_ENDPOINT", "S3_ENDPOINT", "S3_FORCE_PATH_STYLE"];

afterEach(() => vi.unstubAllEnvs());

describe("environment configuration", () => {
	it("creating the adapter reads nothing, so empty variables do not fail a build", () => {
		for (const key of ALL) vi.stubEnv(key, "");
		expect(() => r2Storage()).not.toThrow();
		expect(() => s3Storage()).not.toThrow();
	});

	it("r2Storage() reads R2_* and builds the public URL", () => {
		setEnv(R2);
		const adapter = r2Storage();
		expect(adapter.name).toBe("r2");
		expect(adapter.createStore().getPublicUrl("media/a.png")).toBe("https://cdn.example.com/media/a.png");
	});

	it("s3Storage() reads S3_*", () => {
		setEnv(S3);
		expect(s3Storage().createStore().getPublicUrl("a.png")).toBe("https://cdn.example.com/a.png");
	});

	it("options override the variables", () => {
		setEnv(R2);
		const store = r2Storage({ publicBaseUrl: "https://other.example.com" }).createStore();
		expect(store.getPublicUrl("a.png")).toBe("https://other.example.com/a.png");
	});

	it.each(Object.keys(R2).filter((key) => key !== "R2_ACCOUNT_ID"))("r2Storage names the missing %s", (key) => {
		setEnv(R2);
		vi.stubEnv(key, "");
		expect(() => r2Storage().createStore()).toThrow(key);
	});

	it("r2Storage needs the account ID or the endpoint, and names the account variable", () => {
		setEnv({ ...R2, R2_ACCOUNT_ID: "" });
		expect(() => r2Storage().createStore()).toThrow("R2_ACCOUNT_ID");
		vi.stubEnv("R2_ENDPOINT", "https://x.example.com");
		expect(() => r2Storage().createStore()).not.toThrow();
	});

	it.each(Object.keys(S3).filter((key) => key !== "S3_REGION"))("s3Storage names the missing %s", (key) => {
		setEnv(S3);
		vi.stubEnv(key, "");
		expect(() => s3Storage().createStore()).toThrow(key);
	});

	it("s3Storage needs a region or an endpoint, and names the endpoint variable", () => {
		setEnv({ ...S3, S3_REGION: "" });
		expect(() => s3Storage().createStore()).toThrow("S3_ENDPOINT");
		expect(() => s3Storage({ endpoint: "http://localhost:9000", forcePathStyle: true }).createStore()).not.toThrow();
	});
});
