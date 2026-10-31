import { describe, expect, it } from "vitest";
import { fakeCms } from "../../cms";
import { createPreferencesService } from "../preferences-service";

function setup() {
	const cms = fakeCms();
	let saved: unknown = null;
	const service = createPreferencesService(cms.site, () => ({
		getPreferences: async () => saved as never,
		savePreferences: async ({ preferences }) => {
			saved = preferences;
		},
	}));
	return { service, saved: () => saved };
}

describe("preferences service", () => {
	it("LIST-S4 merges what is sent into what is saved and keeps the rest", async () => {
		const { service } = setup();
		await service.update("u", { collections: { page: { pageSize: 50 } } } as never);
		const next = await service.update("u", { editor: { inspectorOpen: true } } as never);
		expect((next.collections as Record<string, unknown>).page).toMatchObject({ pageSize: 50 });
		expect(next.editor).toMatchObject({ inspectorOpen: true });
		expect((await service.get("u")).editor).toMatchObject({ inspectorOpen: true });
	});
});
