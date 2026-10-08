import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDecision } from "../../server/decision";
import {
	announceStartup,
	coreDecisions,
	QUIET_ENV,
	startupQuiet,
	startupSummaryText,
	WITHCMS_ENV,
	withCmsDecision,
} from "../startup-summary";

const ANNOUNCED = Symbol.for("monti.startup-summary.announced");
const reset = () => {
	delete (globalThis as Record<symbol, unknown>)[ANNOUNCED];
};
afterEach(reset);

const decision = { topic: "Database", value: "localhost:5432/monti", source: "from env DATABASE_URL" };

describe("startup summary text", () => {
	it("formats a decision as topic, value and source", () => {
		expect(formatDecision(decision)).toBe("Database: localhost:5432/monti [from env DATABASE_URL]");
	});

	it("prints a heading that says how to hide it, then one line per decision", () => {
		const lines = startupSummaryText([
			decision,
			{ topic: "Trust host", value: "on", source: "from env AUTH_TRUST_HOST" },
		]).split("\n");
		expect(lines[0]).toContain(`${QUIET_ENV}=1`);
		expect(lines[0]).toContain("monti doctor");
		expect(lines.slice(1)).toEqual([
			"  - Database: localhost:5432/monti [from env DATABASE_URL]",
			"  - Trust host: on [from env AUTH_TRUST_HOST]",
		]);
	});
});

describe("withCmsDecision", () => {
	it("says what withCms added when it ran", () => {
		const result = withCmsDecision({ [WITHCMS_ENV]: "schema types, transpile" });
		expect(result.value).toBe("schema types, transpile");
		expect(result.source).toContain("set in next.config.ts");
	});

	it("says it is not used otherwise", () => {
		const result = withCmsDecision({});
		expect(result.value).toBe("not used");
		expect(result.source).toContain("@monti-cms/nextjs/config");
	});
});

describe("coreDecisions", () => {
	const base = {
		env: { NODE_ENV: "production" },
		trust: { trusted: false, source: "auto-detected (production)" },
		siteUrl: undefined,
		siteUrlSource: undefined,
		schemaFile: undefined,
		schemaFileGiven: false,
		hotReload: false,
	};
	const byTopic = (input: Parameters<typeof coreDecisions>[0]) =>
		Object.fromEntries(coreDecisions(input).map((item) => [item.topic, item]));

	it("reports host trust as on or off with its source", () => {
		expect(byTopic(base)["Trust host"]).toEqual({
			topic: "Trust host",
			value: "off",
			source: "auto-detected (production)",
		});
		expect(byTopic({ ...base, trust: { trusted: true, source: "x" } })["Trust host"]?.value).toBe("on");
	});

	it("says when the site URL is not set, and where it could be", () => {
		expect(byTopic(base).SITE_URL?.value).toBe("not set");
		expect(byTopic(base).SITE_URL?.source).toContain("SITE_URL");
		expect(byTopic({ ...base, siteUrl: "https://a.test", siteUrlSource: "from env SITE_URL" }).SITE_URL).toEqual({
			topic: "SITE_URL",
			value: "https://a.test",
			source: "from env SITE_URL",
		});
	});

	it("tells a given schema file from an auto-detected one", () => {
		expect(byTopic({ ...base, schemaFile: "monti.schema.json", schemaFileGiven: true })["Schema file"]?.source).toBe(
			"set in monti.config.ts",
		);
		expect(byTopic({ ...base, schemaFile: "monti.schema.json" })["Schema file"]?.source).toContain("auto-detected");
		expect(byTopic(base)["Schema file"]?.source).toBe("no schema file found");
	});

	it("explains why hot reload is on or off", () => {
		const on = byTopic({ ...base, env: { NODE_ENV: "development" }, schemaFile: "m.json", hotReload: true });
		expect(on["Schema hot reload"]?.value).toBe("on");
		const off = byTopic({ ...base, schemaFile: "m.json" });
		expect(off["Schema hot reload"]?.value).toBe("off");
		expect(off["Schema hot reload"]?.source).toContain('NODE_ENV is "production"');
		expect(byTopic(base)["Schema hot reload"]?.source).toBe("no schema file to reload");
	});
});

describe("startupQuiet", () => {
	it("is not quiet in a plain development or production process", () => {
		expect(startupQuiet({})).toBe(false);
		expect(startupQuiet({ NODE_ENV: "development" })).toBe(false);
		expect(startupQuiet({ NODE_ENV: "production", NEXT_PHASE: "phase-production-server" })).toBe(false);
		expect(startupQuiet({ [QUIET_ENV]: "0" })).toBe(false);
	});

	it.each([
		["MONTI_QUIET=1", { MONTI_QUIET: "1" }],
		["MONTI_QUIET=true", { MONTI_QUIET: "true" }],
		["MONTI_QUIET=TRUE with spaces", { MONTI_QUIET: " TRUE " }],
		["NODE_ENV=test", { NODE_ENV: "test" }],
		["VITEST set", { VITEST: "true" }],
		["a Next production build", { NEXT_PHASE: "phase-production-build" }],
		["the command line tool", { MONTI_CLI: "1" }],
	])("is quiet for %s", (_name, env) => {
		expect(startupQuiet(env)).toBe(true);
	});
});

describe("announceStartup", () => {
	const loud = { NODE_ENV: "development" };

	it("prints once per process, however many instances ask", () => {
		const log = vi.fn();
		const decisions = vi.fn(() => [decision]);
		announceStartup(decisions, loud, log);
		announceStartup(decisions, loud, log);
		expect(log).toHaveBeenCalledTimes(1);
		expect(decisions).toHaveBeenCalledTimes(1);
		expect(log.mock.calls[0]?.[0]).toContain("Database: localhost:5432/monti [from env DATABASE_URL]");
		expect(log.mock.calls[0]?.[0]).toContain("withCms (next.config): not used");
	});

	it("prints nothing when quiet, and a quiet call does not use up the one print", () => {
		const log = vi.fn();
		announceStartup(() => [decision], { MONTI_QUIET: "1" }, log);
		expect(log).not.toHaveBeenCalled();
		announceStartup(() => [decision], loud, log);
		expect(log).toHaveBeenCalledTimes(1);
	});

	it("never throws, whether the decisions or the log fail", () => {
		expect(() =>
			announceStartup(
				() => {
					throw new Error("no");
				},
				loud,
				vi.fn(),
			),
		).not.toThrow();
		reset();
		expect(() =>
			announceStartup(
				() => [decision],
				loud,
				() => {
					throw new Error("no");
				},
			),
		).not.toThrow();
	});
});
