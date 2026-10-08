import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DoctorReport } from "../doctor";
import { runCli } from "../index";
import { byId, configText, project, setEnv } from "./doctor-helpers";

async function doctor(dir: string) {
	const out: string[] = [];
	const code = await runCli(["doctor", "--json", "--no-env-file", "--only", "config"], {
		cwd: dir,
		log: (message) => out.push(message),
		error: (message) => out.push(message),
	});
	return { code, report: JSON.parse(out.join("\n")) as DoctorReport };
}

const imports = `import { definePlugin } from ${JSON.stringify(path.join(import.meta.dirname, "../../plugin/define.ts"))};`;
const plugin = (requires: string) => `definePlugin({ name: "chart", options: {}, requires: ${requires} })`;

describe("monti doctor and the packages a plugin needs", () => {
	it("fails, naming the plugin, the package and the command, when a required package is not installed", async () => {
		setEnv();
		const dir = project({ "monti.config.ts": configText(plugin('["recharts"]'), imports) });
		const { code, report } = await doctor(dir);
		const check = byId(report, "config/plugin-packages");
		expect(check.status).toBe("fail");
		expect(check.message).toContain("the chart block needs the package recharts");
		expect(check.fix).toMatch(/^(npm install|pnpm add|yarn add|bun add) recharts/);
		expect(code).toBe(1);
	});

	it("passes once the package is there", async () => {
		setEnv();
		const dir = project({
			"monti.config.ts": configText(plugin('["recharts"]'), imports),
			"node_modules/recharts/package.json": "{}",
		});
		const { report } = await doctor(dir);
		expect(byId(report, "config/plugin-packages")).toMatchObject({ status: "ok", message: "installed: recharts" });
	});

	it("is fine with plugins that need nothing", async () => {
		setEnv();
		const dir = project({ "monti.config.ts": configText(`definePlugin({ name: "plain", options: {} })`, imports) });
		const { report } = await doctor(dir);
		expect(byId(report, "config/plugin-packages").status).toBe("ok");
	});
});
