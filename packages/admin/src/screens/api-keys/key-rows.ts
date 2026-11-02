import type { ApiKeyList, ApiKeySlotView, ApiKeyView, Site } from "@monti-cms/core/site";

/** Tokens as the keys list shows them: `312K`, `1.24M` (three significant digits), plain below a thousand. */
export function formatTokens(site: Pick<Site, "ADMIN_LOCALE">, tokens: number): string {
	const format = (value: number, unit: string) =>
		`${new Intl.NumberFormat(site.ADMIN_LOCALE, { maximumSignificantDigits: 3 }).format(value)}${unit}`;
	if (tokens >= 1_000_000) return format(tokens / 1_000_000, "M");
	if (tokens >= 1_000) return format(tokens / 1_000, "K");
	return String(tokens);
}

/** The host of an address (`localhost:11434`), the name a key of an OpenAI-compatible server starts with; empty while the address is not one yet. */
export function hostOf(url: string): string {
	try {
		return new URL(url.trim()).host;
	} catch {
		return "";
	}
}

export interface SlotRow {
	readonly slot: ApiKeySlotView;
	/** The service's name ("Speller"). */
	readonly title: string;
	/** The slot's own name after it, when its plugin asks for more than one key ("Search key"). */
	readonly detail?: string;
	/** The keys of the slot's service, to pick from. */
	readonly keys: readonly ApiKeyView[];
}

/** The rows of the plugins' keys: titled by the service, with the slot's name when its plugin has several, in the order the plugins declare them. */
export function slotRows(list: ApiKeyList): SlotRow[] {
	const perPlugin = new Map<string, number>();
	for (const slot of list.slots) perPlugin.set(slot.plugin, (perPlugin.get(slot.plugin) ?? 0) + 1);
	return list.slots.map((slot) => ({
		slot,
		title: list.services.find((service) => service.id === slot.service)?.label ?? slot.label,
		...((perPlugin.get(slot.plugin) ?? 0) > 1 ? { detail: slot.label } : {}),
		keys: list.items.filter((key) => key.service === slot.service),
	}));
}
