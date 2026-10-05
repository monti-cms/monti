import { CmsAdminComponentsProvider, useCmsAdminComponents } from "@monti-cms/admin";
import { defineCollection, defineConfig, fields } from "@monti-cms/core";
import { render, screen, waitFor } from "@testing-library/react";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { blocks, callout, color, DEFAULT_TEXT_PALETTE } from "..";
import { ChartProvider } from "../chart/provider";
import { MermaidProvider } from "../mermaid/provider";

const names = (plugins: readonly { name: string }[]) => plugins.map((plugin) => plugin.name);

describe("blocks()", () => {
	it("adds every block extension at once (inline marks in tooltip → code ref → text color order)", () => {
		const all = names(blocks());
		for (const name of [
			"callout",
			"collapsible",
			"tabs",
			"columns",
			"mermaid",
			"chart",
			"tooltip",
			"code-ref",
			"color",
		]) {
			expect(all).toContain(name);
		}
		expect(all.indexOf("tooltip")).toBeLessThan(all.indexOf("code-ref"));
		expect(all.indexOf("code-ref")).toBeLessThan(all.indexOf("color"));
		// Same as the extensions created one by one.
		expect(blocks({ only: ["callout"] })[0]?.blocks).toEqual(callout().blocks);
	});

	it("picks (`only`), omits (`omit`·`false`) and passes per-extension options", () => {
		expect(names(blocks({ only: ["tooltip", "color"] }))).toEqual(["tooltip", "color"]);
		const remaining = names(blocks({ omit: ["chart", "mermaid"], codeRef: false }));
		for (const omitted of ["chart", "mermaid", "code-ref"]) expect(remaining).not.toContain(omitted);
		for (const kept of ["callout", "collapsible", "tabs", "columns", "tooltip", "color"])
			expect(remaining).toContain(kept);
		const palette = [DEFAULT_TEXT_PALETTE[0]].filter((item) => item !== undefined);
		const [colorPlugin] = blocks({ only: ["color"], color: { palette } });
		expect(colorPlugin?.options).toEqual({ palette });
		expect(colorPlugin?.options).toEqual(color({ palette }).options);
		expect(() => blocks({ only: ["nope" as never] })).toThrow(/unknown block extension "nope"/);
	});

	it("spreading into the site config adds the blocks, and invalid options are config errors", () => {
		const post = defineCollection({ label: "Post", kind: "document", fields: { title: fields.text({ label: "T" }) } });
		const base = { collections: { post }, locales: [{ code: "en", name: "English" }], defaultLocale: "en" } as const;
		expect(() => defineConfig({ ...base, plugins: [...blocks()] })).not.toThrow();
		expect(() =>
			defineConfig({
				...base,
				plugins: [
					...blocks({
						color: {
							palette: [
								{ id: "x", name: "x", fg: { light: "red", dark: "#fff" }, bg: { light: "#fff", dark: "#000" } },
							],
						},
					}),
				],
			}),
		).toThrow(/hex/);
		// Adding the same extension twice is a config error.
		expect(() => defineConfig({ ...base, plugins: [...blocks(), callout()] })).toThrow();
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
