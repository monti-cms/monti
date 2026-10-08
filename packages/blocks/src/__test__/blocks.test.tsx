import { CmsAdminComponentsProvider, useCmsAdminComponents } from "@monti-cms/admin";
import { defineCollection, defineSite, fields, translate } from "@monti-cms/core";
import { render, screen, waitFor } from "@testing-library/react";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { callout, codeExplorer, codeRef, collapsible, color, columns, defaultTextPalette, tabs, tooltip } from "..";
import { chart } from "../chart";
import { ChartProvider } from "../chart/provider";
import { colorMessages } from "../color/messages";
import { mermaid } from "../mermaid";
import { MermaidProvider } from "../mermaid/provider";

const names = (plugins: readonly { name: string }[]) => plugins.map((plugin) => plugin.name);

const post = defineCollection({ label: "Post", kind: "document", fields: { title: fields.text({ label: "T" }) } });
const base = { collections: { post }, locales: [{ code: "en", name: "English" }], defaultLocale: "en" } as const;

describe("one plugin per block", () => {
	it("every block extension is a plain plugin entry that works with no arguments", () => {
		const everyone = [callout, collapsible, tabs, columns, codeExplorer, mermaid, chart, tooltip, codeRef, color];
		for (const factory of everyone) {
			const plugin = factory();
			expect(plugin.name, factory.name).toMatch(/^[a-z][a-z-]*$/);
			expect((plugin.blocks ?? []).length, plugin.name).toBeGreaterThan(0);
			expect(plugin.render, plugin.name).toBeTypeOf("function");
		}
		expect(names(everyone.map((factory) => factory()))).toEqual([
			"callout",
			"collapsible",
			"tabs",
			"columns",
			"code-explorer",
			"mermaid",
			"chart",
			"tooltip",
			"code-ref",
			"color",
		]);
	});

	it("there is no bundle that adds them all behind one call", async () => {
		const exported = await import("..");
		expect(exported).not.toHaveProperty("blocks");
	});

	it("listing them in the config adds exactly the blocks listed, in the order given", () => {
		const config = defineSite({ ...base, plugins: [tooltip(), callout(), codeRef()] });
		expect(names(config.plugins ?? [])).toEqual(["tooltip", "callout", "code-ref"]);
	});

	it("a block that is not listed is not there", () => {
		const blocksOf = (config: { plugins?: readonly { blocks?: readonly { name: string }[] }[] }) =>
			(config.plugins ?? []).flatMap((plugin) => (plugin.blocks ?? []).map((block) => block.name));
		const some = blocksOf(defineSite({ ...base, plugins: [callout(), tooltip()] }));
		expect(some).toContain("callout");
		expect(some).not.toContain("chart");
		expect(some).not.toContain("tabs");
	});

	it("takes its own options, and a bad option is a config error", () => {
		const palette = [defaultTextPalette((key) => translate(colorMessages, "en", key))[0]].filter(
			(item) => item !== undefined,
		);
		expect(color({ palette }).options).toEqual({ palette });
		expect(() => defineSite({ ...base, plugins: [color({ palette })] })).not.toThrow();
		expect(() =>
			defineSite({
				...base,
				plugins: [
					color({
						palette: [{ id: "x", name: "x", fg: { light: "red", dark: "#fff" }, bg: { light: "#fff", dark: "#000" } }],
					}),
				],
			}),
		).toThrow(/hex/);
	});

	it("adding the same block twice is a config error", () => {
		expect(() => defineSite({ ...base, plugins: [callout(), callout()] })).toThrow();
	});
});

/** Loads the registered fence preview and shows its name (component name). */
function LoadedPreview({ lang }: { lang: string }) {
	const load = useCmsAdminComponents().fencePreviews?.[lang];
	const [component, setComponent] = useState<ComponentType<{ source: string }> | null>(null);
	useEffect(() => {
		void load?.().then((loaded) => setComponent(() => loaded));
	}, [load]);
	return <p>{load ? (component ? `${lang}: ${component.name}` : `${lang}: loading`) : `${lang}: none`}</p>;
}

describe("editor preview", () => {
	const SitePreview = () => null;

	it("the Mermaid and chart extensions register default previews and load the renderer when a preview opens", async () => {
		render(
			<MermaidProvider>
				<ChartProvider>
					<LoadedPreview lang="mermaid" />
					<LoadedPreview lang="chart" />
				</ChartProvider>
			</MermaidProvider>,
		);
		// The first load of the renderer module is slow, so extend the wait.
		await waitFor(() => expect(screen.getByText("mermaid: MermaidPreview")).toBeTruthy(), { timeout: 15_000 });
		await waitFor(() => expect(screen.getByText("chart: ChartPreview")).toBeTruthy(), { timeout: 15_000 });
	}, 30_000);

	it("a preview the site registers under the same name (inner provider) wins", async () => {
		const Site = ({ children }: { children: ReactNode }) => (
			<CmsAdminComponentsProvider components={{ fencePreviews: { chart: async () => SitePreview } }}>
				{children}
			</CmsAdminComponentsProvider>
		);
		render(
			<ChartProvider>
				<Site>
					<LoadedPreview lang="chart" />
				</Site>
			</ChartProvider>,
		);
		await waitFor(() => expect(screen.getByText("chart: SitePreview")).toBeTruthy());
	});
});
