import type { TrashEffects, TrashMoved, TrashRef, TrashRestored, TrashRow } from "@monti-cms/core";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	toast,
} from "@monti-cms/ui";
import { useRef, useState } from "react";
import { useUndo } from "../activity/use-undo";
import { useAdmin } from "../operations/admin-context";
import { reasonOf, useOperation } from "../operations/use-operation";
import { holdsKeyboardFocus } from "../screens/frame/focus-hand-off";
import { useLanguageName } from "../screens/list/column-menu";
import { endsClosed } from "../screens/list/format";

/** What goes to the trash, and what the question and the toast call it. */
export type TrashAsk = {
	rows: TrashRef[];
	/** One entry: its title, for the question about a published one. */
	title?: string;
	/** A folder: its name and how many entries it holds, for its question and its toast. */
	folder?: { name: string; count: number };
	/** Items: what one is called (the collection's label, "Tag"), for the question about published entries that point at it. */
	item?: string;
	onMoved?: (moved: TrashMoved) => void;
	/** A file stayed because something uses it: the toast shows the first of them. */
	onKept?: (id: string) => void;
};

/**
 * What published entries lose when an item they point at goes to the trash: the sentence the question says, by hand and when an undo does it.
 */
export function pointingWords(
	t: ReturnType<typeof useAdmin>["t"],
	{ count, one, label }: { count: number; one: boolean; label: string },
): string {
	return t(one ? "trash.askPointing" : "trash.askPointingMany", {
		count,
		label,
		subject: t(endsClosed(label) ? "list.subjectFinal" : "list.subjectOpen", { name: label }),
	});
}

/**
 * Puts rows in the trash, the one way every screen does (doc 11): it asks first only when the site changes (a published entry goes off it, or published entries lose an
 * item they point at), and the toast takes the move back. Files in use stay, and the toast says how many.
 */
export function useTrashMove() {
	const { t } = useAdmin();
	const languageName = useLanguageName();
	const check = useOperation<TrashEffects>("trash.checkMove");
	const move = useOperation<{ activityId: string; output: TrashMoved }>("trash.move");
	const undo = useUndo();
	const [asking, setAsking] = useState<{ ask: TrashAsk; effects: TrashEffects } | null>(null);

	const run = async (ask: TrashAsk) => {
		setAsking(null);
		const result = await move.run({ rows: ask.rows });
		if (!result.ok) return void toast.error(t(reasonOf(result.refusal)));
		const { activityId, output } = result.body;
		ask.onMoved?.(output);
		const [kept] = output.kept;
		if (kept)
			return void toast(
				t(ask.folder ? "library.keptFolder" : "library.kept", { moved: output.moved.length, kept: output.kept.length }),
				{ action: { label: t("library.show"), onClick: () => ask.onKept?.(kept) } },
			);
		toast(t("trash.moved"), {
			action: { label: t("settings.undo"), onClick: () => void undo.run(activityId) },
		});
	};
	const start = async (ask: TrashAsk) => {
		if (ask.rows.length === 0) return;
		const effects = await check.run({ rows: ask.rows });
		if (!effects.ok) return void toast.error(t(reasonOf(effects.refusal)));
		if (effects.body.unpublished > 0 || effects.body.pointing > 0) return setAsking({ ask, effects: effects.body });
		await run(ask);
	};

	const lines = (): string[] => {
		if (!asking) return [];
		const { ask, effects } = asking;
		if (ask.folder) return [t("folders.removeText", { count: ask.folder.count, published: effects.unpublished })];
		const said: string[] = [];
		if (effects.unpublished > 0)
			said.push(
				ask.rows.length === 1 && ask.title
					? t("trash.askPublishedOne", { title: ask.title })
					: t("trash.askPublished", { count: effects.unpublished }),
			);
		if (effects.unpublished > 0 && ask.rows.length === 1 && effects.translations.length > 0)
			said.push(t("trash.askTranslations", { languages: effects.translations.map(languageName).join(", ") }));
		if (effects.pointing > 0)
			said.push(
				pointingWords(t, { count: effects.pointing, one: ask.rows.length === 1, label: ask.item ?? t("trash.item") }),
			);
		return said;
	};
	const dialog = (
		<AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{asking?.ask.folder ? t("folders.removeTitle", { name: asking.ask.folder.name }) : t("trash.askTitle")}
					</AlertDialogTitle>
					<AlertDialogDescription>{lines().join(" ")}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
					<AlertDialogAction variant="danger" onClick={() => asking && void run(asking.ask)}>
						{t("trash.toTrash")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
	return { start, dialog };
}

/**
 * Brings rows back from the trash and says how they came back: a document as a draft, with "Open"; with the folder that came back to hold it; an item under the
 * address it has now, when another took its own.
 */
export function useRestore({
	onOpen,
	onRestored,
}: {
	/** Opens the one entry that came back. */
	onOpen?: (entry: NonNullable<TrashRestored["entry"]>) => void;
	onRestored?: (restored: TrashRestored) => void;
} = {}) {
	const { t } = useAdmin();
	const restore = useOperation<{ output: TrashRestored }>("trash.restore");
	const run = async (rows: TrashRef[]) => {
		if (rows.length === 0) return false;
		const result = await restore.run({ rows });
		if (!result.ok) {
			toast.error(t(reasonOf(result.refusal)));
			return false;
		}
		const { output } = result.body;
		onRestored?.(output);
		const { entry } = output;
		const [renamed] = output.renamed;
		const [folder] = output.folders;
		const words = folder
			? t("trash.restoredWithFolder", { name: folder })
			: renamed
				? t("trash.restoredAs", { slug: renamed.to })
				: entry?.draft
					? t("trash.restoredDraft")
					: t("trash.restored");
		// An item has no page of its own to open: only a document comes with "Open".
		toast(words, entry?.draft && onOpen ? { action: { label: t("trash.open"), onClick: () => onOpen(entry) } } : {});
		return true;
	};
	return { run, pending: restore.pending };
}

/** What a permanent delete asks about: the rows, and for a row of the list the paths it would keep from other entries. */
type PurgeAsk = {
	rows: TrashRef[];
	reserves?: TrashRow["reserves"];
	onPurged?: () => void;
	/**
	 * Where the focus goes when what opened the question is gone by the time it closes (the delete answered first); `null` from it leaves
	 * the question's own way, back to what opened it. Used only for a delete confirmed with the keyboard: a pointer's press holds no focus.
	 */
	whenGone?: () => HTMLElement | null;
};

/** Deletes rows of the trash for good, after asking every time: it cannot be undone (doc 11). Emptying the trash asks the same way. */
export function usePurge() {
	const { t } = useAdmin();
	const purge = useOperation("trash.purge");
	const empty = useOperation<{ output: { purged: number } }>("trash.empty");
	const [asking, setAsking] = useState<PurgeAsk | { all: number } | null>(null);
	/** Where the focus goes if the rows are gone before the question has closed, for a delete confirmed with the keyboard (`whenGone`). */
	const gone = useRef<(() => HTMLElement | null) | null>(null);
	const run = async (byKeys: boolean) => {
		gone.current = byKeys && asking && !("all" in asking) ? (asking.whenGone ?? null) : null;
		const ask = asking;
		setAsking(null);
		if (!ask) return;
		if ("all" in ask) {
			const result = await empty.run({});
			if (!result.ok) return void toast.error(t(reasonOf(result.refusal)));
			return void toast(t("trash.emptied", { count: result.body.output.purged }));
		}
		const result = await purge.run({ rows: ask.rows });
		if (!result.ok) return void toast.error(t(reasonOf(result.refusal)));
		ask.onPurged?.();
		toast(t("trash.purged"));
	};
	const reserves = asking && !("all" in asking) ? (asking.reserves ?? []) : [];
	const [address] = reserves;
	const text =
		asking && "all" in asking
			? t("trash.emptyText", { count: asking.all })
			: [
					// How much goes, where the question's title does not say: several rows, or a folder with what it holds.
					asking && asking.rows.length > 1
						? t("trash.purgeCount", { count: asking.rows.length })
						: asking?.rows[0]?.kind === "folder"
							? t("trash.purgeFolder")
							: "",
					t("trash.purgeText"),
					reserves.length === 1 && address
						? t(endsClosed(address) ? "trash.purgeAddressFinal" : "trash.purgeAddressOpen", { address })
						: reserves.length > 1
							? t("trash.purgeAddresses", { count: reserves.length })
							: "",
				]
					.filter(Boolean)
					.join(" ");
	const all = asking !== null && "all" in asking;
	const dialog = (
		<AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
			{/* The question gives the focus back to what opened it; a row's ⋯ that then goes with its row hands it on (`HandedRowActions`).
			    When the delete has answered before the question has closed, there is nothing to give it back to: `whenGone` says where. */}
			<AlertDialogContent finalFocus={() => gone.current?.() ?? null}>
				<AlertDialogHeader>
					<AlertDialogTitle>{t(all ? "trash.emptyTitle" : "trash.purgeTitle")}</AlertDialogTitle>
					<AlertDialogDescription>{text}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
					<AlertDialogAction variant="danger" onClick={(event) => void run(holdsKeyboardFocus(event.currentTarget))}>
						{t(all ? "trash.empty" : "trash.purge")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
	return {
		start: (ask: PurgeAsk) => {
			gone.current = null;
			return ask.rows.length > 0 && setAsking(ask);
		},
		/** Asks to empty the trash of its `count` rows. */
		startEmpty: (count: number) => {
			// Nothing of an earlier delete's: closed without emptying, the question gives the focus back to what opened it.
			gone.current = null;
			setAsking({ all: count });
		},
		dialog,
	};
}
