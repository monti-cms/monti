import type { StoredDocument } from "@monti-cms/core/document";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
	AdminComponentsProvider,
	type BrowserFormat,
	type SourcePanelRegistration,
	useAdminComponents,
	useFormat,
	useSourceFormat,
} from "../admin-components";

const fakeFormat = (name: string): BrowserFormat => ({
	name,
	label: name.toUpperCase(),
	export: (_doc: StoredDocument) => name,
	import: () => ({ ok: false, issues: [] }),
});

const panel = (format: string): SourcePanelRegistration => ({ format, label: `${format} panel`, Panel: () => null });

function Probe() {
	const components = useAdminComponents();
	const found = useFormat("alpha");
	const missing = useFormat("nothing");
	const source = useSourceFormat();
	return (
		<output>
			{JSON.stringify({
				panels: (components.sourcePanels ?? []).map((entry) => entry.format),
				formats: Object.keys(components.formats ?? {}),
				found: found?.label ?? null,
				missing: missing === undefined,
				source: source?.name ?? null,
			})}
		</output>
	);
}

const probed = () => JSON.parse(screen.getByRole("status").textContent ?? "{}");

describe("the admin components registry", () => {
	afterEach(() => document.body.replaceChildren());

	it("PLUG-A12 adds source panels and formats up across nested providers, outer ones first", () => {
		render(
			<AdminComponentsProvider components={{ sourcePanels: [panel("alpha")], formats: { alpha: fakeFormat("alpha") } }}>
				<AdminComponentsProvider components={{ sourcePanels: [panel("beta")], formats: { beta: fakeFormat("beta") } }}>
					<Probe />
				</AdminComponentsProvider>
			</AdminComponentsProvider>,
		);
		const result = probed();
		expect(result.panels).toHaveLength(2);
		expect(result.panels.indexOf("alpha")).toBeLessThan(result.panels.indexOf("beta"));
		expect([...result.formats].sort()).toEqual(["alpha", "beta"]);
	});

	it("finds a registered format by name, and gives undefined for any other name", () => {
		render(
			<AdminComponentsProvider components={{ formats: { alpha: fakeFormat("alpha") } }}>
				<Probe />
			</AdminComponentsProvider>,
		);
		expect(probed()).toMatchObject({ found: "ALPHA", missing: true });
	});

	it("PLUG-A12 uses the format of the first registered panel as the source format", () => {
		render(
			<AdminComponentsProvider
				components={{
					sourcePanels: [panel("beta")],
					formats: { alpha: fakeFormat("alpha"), beta: fakeFormat("beta") },
				}}
			>
				<AdminComponentsProvider components={{ sourcePanels: [panel("alpha")] }}>
					<Probe />
				</AdminComponentsProvider>
			</AdminComponentsProvider>,
		);
		expect(probed().source).toBe("beta");
	});
});
