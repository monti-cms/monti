import path from "node:path";
import { describe, expect, it } from "vitest";
import { addComponents } from "../add";
import { initProject } from "../init";
import { INIT_PROXY_TEMPLATE } from "../proxy-template";
import { fakeHost, fixtureApp, listFiles, read, SRC_APP } from "./init-helpers";

const quiet = () => ({ host: fakeHost(), env: {}, install: false });
const REGISTRY = path.resolve(import.meta.dirname, "../../../../../registry/r");

describe("monti init and the 503 page for a site whose login is not set up", () => {
	it("writes a proxy.ts that answers it, since a page cannot send that status under Cache Components", async () => {
		const dir = fixtureApp();
		const report = await initProject({ cwd: dir, ...quiet() });
		expect(report.created).toContain("proxy.ts");
		const proxy = read(dir, "proxy.ts");
		expect(proxy).toContain('import { cmsProxy } from "@monti-cms/nextjs/proxy";');
		expect(proxy).toContain('import { cms } from "./monti.config";');
		expect(proxy).toContain("export const proxy = cmsProxy(cms);");
	});

	it("puts it beside the config in a src/ app", async () => {
		const dir = fixtureApp(SRC_APP);
		await initProject({ cwd: dir, ...quiet() });
		expect(listFiles(dir)).toContain("src/proxy.ts");
		expect(listFiles(dir)).not.toContain("proxy.ts");
	});

	it("leaves a proxy or middleware the app already has, and says how to add the check to it", async () => {
		for (const name of ["proxy.ts", "middleware.ts"]) {
			const dir = fixtureApp({ [name]: "export function proxy() {}\n" });
			const report = await initProject({ cwd: dir, ...quiet() });
			expect(read(dir, name)).toBe("export function proxy() {}\n");
			expect(listFiles(dir).filter((file) => /^(proxy|middleware)\./.test(file))).toEqual([name]);
			expect(report.notes.join("\n")).toContain(`${name} already exists and was left alone`);
			expect(report.notes.join("\n")).toContain("setupResponse(request, cms)");
		}
	});

	it("is left out when the blog theme is chosen: the theme's proxy does it and more", async () => {
		const dir = fixtureApp();
		await initProject({ cwd: dir, host: fakeHost(), env: {}, blogTheme: true, database: "skip" });
		expect(read(dir, "proxy.ts")).toContain("blogProxy");
		expect(read(dir, "components/monti/blog-theme/blog-proxy.ts")).toContain("setupResponse(request, blogTheme.cms)");
	});

	it("monti add blog-theme replaces the proxy init wrote without asking, but never one the person wrote", async () => {
		const generated = fixtureApp();
		await initProject({ cwd: generated, ...quiet() });
		expect(read(generated, "proxy.ts")).toBe(INIT_PROXY_TEMPLATE);
		const report = await addComponents({
			cwd: generated,
			names: ["blog-theme"],
			registry: REGISTRY,
			install: () => undefined,
			yes: true,
		});
		expect(report.conflicts).toEqual([]);
		expect(report.overwritten).toEqual(["proxy.ts"]);
		expect(read(generated, "proxy.ts")).toContain("blogProxy");

		const own = fixtureApp({ "proxy.ts": "// mine\nexport function proxy() {}\n" });
		await initProject({ cwd: own, ...quiet() });
		const kept = await addComponents({
			cwd: own,
			names: ["blog-theme"],
			registry: REGISTRY,
			install: () => undefined,
			yes: true,
		});
		expect(kept.conflicts).toEqual(["proxy.ts"]);
		expect(read(own, "proxy.ts")).toBe("// mine\nexport function proxy() {}\n");
	});
});
