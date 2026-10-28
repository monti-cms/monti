import type { IncomingReferenceItem, ListEntriesItem, Site } from "@monti-cms/core/site";
import { commonMessages } from "../../lib/common.messages";
import type { ConfirmRequest } from "../shared/confirm-dialog";
import { deleteMessages } from "../shared/delete.messages";
import { nounVars } from "../shared/noun.messages";
import { type EntryData, isTranslationEntry } from "./entry-form";
import { entriesMessages } from "./messages";

/** Status transitions of the edit screen. */
export type LifecycleAction = "archive" | "unarchive" | "trash" | "restore";

/** Transitions that ask first from the edit screen's menu. Archiving a published entry asks; the trash asks only through {@link trashConfirm}. */
export type ConfirmedLifecycleAction = Extract<LifecycleAction, "archive">;

/** Name of the transition. Buttons and the "save first" hint use the same words. */
export const lifecycleLabel = (site: Site): Record<LifecycleAction, string> => {
	const tc = site.createTranslator(commonMessages);
	return {
		archive: tc("lifecycle.archive"),
		unarchive: tc("lifecycle.unarchive"),
		trash: tc("lifecycle.trash"),
		restore: tc("lifecycle.restore"),
	};
};

/** Text to announce after the transition finishes. */
export const lifecycleSuccess = (site: Site): Record<LifecycleAction, string> => {
	const t = site.createTranslator(entriesMessages);
	return {
		archive: t("lifecycle.success.archive"),
		unarchive: t("lifecycle.success.unarchive"),
		trash: t("lifecycle.success.trash"),
		restore: t("lifecycle.success.restore"),
	};
};

/**
 * Confirmation text for archiving a published entry. Also tells if the published version is used elsewhere,
 * and that archiving the original also archives translations in the same group.
 */
export function lifecycleConfirm(
	site: Site,
	action: ConfirmedLifecycleAction,
	entry: Pick<EntryData, "id" | "translationGroupId" | "translations"> | null,
	incomingReferences: readonly Pick<IncomingReferenceItem, "state">[],
	collection: string,
): Omit<ConfirmRequest, "onConfirm"> {
	const t = site.createTranslator(entriesMessages);
	const label = lifecycleLabel(site);
	const noun = nounVars(site, collection);
	const publishedUsers = incomingReferences.filter((item) => item.state === "published").length;
	const usageNote = publishedUsers > 0 ? t("lifecycle.usage", { count: publishedUsers, ...noun }) : "";
	const isTranslation = entry !== null && isTranslationEntry(entry);
	const hasGroup =
		entry && !isTranslation
			? (entry.translations ?? []).some((member) => member.id !== entry.id && member.status !== "trashed")
			: false;
	return {
		title: label[action],
		description: `${t("lifecycle.archive.ask", { translation: isTranslation ? 1 : 0, ...noun })}${usageNote}${hasGroup ? t("lifecycle.archive.group") : ""}`,
		confirmLabel: label[action],
	};
}

/** What the question about the trash needs to know of one thing going there. */
export interface TrashSubject {
	readonly title: string | null;
	/** Whether it is public now (`published`, with or without changes after it). */
	readonly status: string;
	/** The other languages of its group that go along with it (a translation goes alone), each with its own status. */
	readonly alongside: readonly { readonly locale: string; readonly status: string }[];
}

/** A row of the list as a {@link TrashSubject}: the group's other languages go along. */
export const trashSubjectOfRow = (
	row: Pick<ListEntriesItem, "id" | "title" | "status" | "translations">,
): TrashSubject => ({
	title: row.title,
	status: row.status,
	alongside: (row.translations ?? []).filter((member) => member.id !== row.id && member.status !== "trashed"),
});

/** The entry open in the editor as a {@link TrashSubject}. */
export const trashSubjectOfEntry = (site: Site, entry: EntryData): TrashSubject => ({
	title: site.titleOfValues(entry.collection, entry.working.metadata) ?? null,
	status: entry.status,
	alongside: isTranslationEntry(entry)
		? []
		: (entry.translations ?? []).filter((member) => member.id !== entry.id && member.status !== "trashed"),
});

const isPublic = (subject: TrashSubject) =>
	subject.status === "published" || subject.alongside.some((member) => member.status === "published");

/**
 * The question asked before things go to the trash, or `null` when nothing needs asking. Only a public entry asks, because moving it takes it
 * off the site at once: a published entry, or one whose translation is published. Drafts, archived entries, notes and items move at once (the
 * trash can be undone). One entry names itself and the translations that go with it; several only say how many come down.
 */
export function trashConfirm(
	site: Site,
	collection: string,
	subjects: readonly TrashSubject[],
): Omit<ConfirmRequest, "onConfirm"> | null {
	// Items (tags and the like) are never public pages of their own.
	if (!site.isDocumentCollection(collection)) return null;
	const going = subjects.filter(isPublic);
	if (going.length === 0) return null;
	const t = site.createTranslator(deleteMessages);
	const tc = site.createTranslator(commonMessages);
	const languages = (members: TrashSubject["alongside"]) =>
		members.map((member) => site.localeLabel(member.locale)).join("·");
	const subject = subjects[0] as TrashSubject;
	// The board shows these two texts only. A draft whose translation is published reads like a published entry.
	const description =
		subjects.length > 1
			? t("trash.ask.many", { count: going.length })
			: `${t("trash.ask.one", { title: subject.title || tc("untitled") })}${
					subject.alongside.length > 0 ? t("trash.ask.translations", { languages: languages(subject.alongside) }) : ""
				}`;
	return {
		title: t("trash.ask.title"),
		description,
		confirmLabel: t("trash.ask.confirm"),
		destructive: true,
	};
}
