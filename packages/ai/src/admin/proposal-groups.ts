import type { Site } from "@monti-cms/admin";
import type { ProposalView } from "../agent/proposal-view";
import { proposalMessages } from "./proposal.messages";

export type ProposalItemView = ProposalView["items"][number];

/** The changes of one kind in a proposal: the same operation on the same field (or to the same folder). A card shows one row per group. */
export interface ProposalGroup {
	readonly key: string;
	readonly operation: string;
	readonly items: readonly ProposalItemView[];
}

const groupKey = (item: ProposalItemView): string => {
	if (item.operation === "entries.moveToFolder") return `${item.operation}:${String(item.preview.after)}`;
	if (item.operation === "entries.updateFields" || item.operation === "media.updateText") {
		return `${item.operation}:${item.target.spot ?? ""}`;
	}
	return item.operation;
};

/** The groups of a proposal, in the order their first change was proposed. */
export function groupsOf(view: Pick<ProposalView, "items">): ProposalGroup[] {
	const groups = new Map<string, { operation: string; items: ProposalItemView[] }>();
	for (const item of view.items) {
		const key = groupKey(item);
		const group = groups.get(key) ?? { operation: item.operation, items: [] };
		group.items.push(item);
		groups.set(key, group);
	}
	return [...groups].map(([key, group]) => ({ key, ...group }));
}

/** A proposal made only of new alt texts or captions: the card shows each file's new text instead of groups, and has no review page (flow 2 · 19). */
export const isMediaTextOnly = (view: Pick<ProposalView, "items">): boolean =>
	view.items.length > 0 && view.items.every((item) => item.operation === "media.updateText");

const isEmpty = (value: unknown) =>
	value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

/** The label of a field of an entry's collection, or its name when the site does not know it. */
export function fieldLabel(site: Site, collection: string | undefined, field: string | undefined): string {
	if (!field) return "";
	const stored = collection ? site.storedField(collection as never, field) : undefined;
	const label = (stored?.field as { label?: unknown } | undefined)?.label;
	return typeof label === "string" && label ? label : field;
}

/** How a group reads in a card and on the review page: its name ("Fill summary", "Move to 2024"), where (the entry, when there is one), and how many. */
export function groupWords(site: Site, group: ProposalGroup): { name: string; detail?: string; count: string } {
	const t = site.createTranslator(proposalMessages);
	const [first] = group.items;
	const many = group.items.length;
	const entries = t("count.entries", { count: many });
	const files = t("count.files", { count: many });
	const single = many === 1 && first?.subject?.title ? { detail: first.subject.title } : {};
	switch (group.operation) {
		case "entries.updateFields": {
			const label = fieldLabel(site, first?.subject?.collection, first?.target.spot);
			const filling = group.items.every((item) => isEmpty(item.preview.before));
			return { name: t(filling ? "group.fill" : "group.change", { field: label }), ...single, count: entries };
		}
		case "entries.moveToFolder": {
			const folder = first?.shown?.after;
			return { name: folder ? t("group.move", { folder }) : t("group.unfolder"), ...single, count: entries };
		}
		case "entries.trash":
			return { name: t("group.trash"), ...single, count: entries };
		case "media.updateText":
			return {
				name: t(first?.target.spot === "defaultCaption" ? "group.caption" : "group.alt"),
				...single,
				count: files,
			};
		case "media.trash":
			return { name: t("group.trash"), detail: t("group.media"), count: files };
		default:
			return { name: group.operation, ...single, count: t("count.items", { count: many }) };
	}
}

/** Why an item could not be applied or reverted, in words ("changed meanwhile", "went to the trash meanwhile"). */
export function reasonWords(site: Site, reason: string | undefined): string {
	const t = site.createTranslator(proposalMessages);
	switch (reason) {
		case "changed":
		case "conflict":
			return t("reason.changed");
		case "invalid_status":
		case "not_found":
			return t("reason.gone");
		case "in_use":
			return t("reason.inUse");
		default:
			return t("reason.failed");
	}
}

/** The time of day of an ISO date ("10:52"). */
export const timeOf = (iso: string | undefined): string => {
	if (!iso) return "";
	const at = new Date(iso);
	return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
};
