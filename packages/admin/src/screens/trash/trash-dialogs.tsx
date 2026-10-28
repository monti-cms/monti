"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	ChangeGroup,
	ChangeLine,
	ChangeLines,
	ChangeNote,
	TextButton,
} from "@monti-cms/ui";
import { commonMessages } from "../../lib/common.messages";
import { AdminLink as Link } from "../../router";
import { entryHref } from "../shared/entry-href";
import { collectionNoun } from "../shared/noun.messages";
import { trashMessages } from "./messages";
import {
	addressOf,
	type Blocker,
	canDelete,
	type DeletePlan,
	itemKey,
	keepsAddress,
	liveResolved,
	titleOf,
	trashedResolved,
} from "./trash-model";
import type { TrashActions } from "./use-trash-actions";

/** One unit that something points at: its name and kind, and a line for the entries in use and one for those in the trash, each with its way out. */
function BlockerGroup({ blocker, plan, actions }: { blocker: Blocker; plan: DeletePlan; actions: TrashActions }) {
	const site = useSite();
	const t = useTranslator(trashMessages);
	const tc = useTranslator(commonMessages);
	const title = titleOf(site, blocker.item);
	const collection = blocker.item.type === "entry" ? collectionNoun(site, blocker.item.collection) : "";
	const firstLive = blocker.live[0];
	const firstTrashed = blocker.trashed[0];
	return (
		<ChangeGroup kind="drop" tag={t("blocked.tag")} title={title} identifier={collection}>
			<ChangeLines>
				{firstLive && (
					<ChangeLine
						what={
							<>
								{t("blocked.live", { count: blocker.live.length })} ·{" "}
								<TextButton
									variant="underline"
									render={<Link href={entryHref(site, firstLive.collection, firstLive.entryId)} />}
								>
									{firstLive.title || tc("untitled")}
								</TextButton>
								{blocker.live.length > 1 && ` ${t("blocked.more", { count: blocker.live.length - 1 })}`}
							</>
						}
						tone={liveResolved(plan, blocker) ? "default" : "warning"}
						then={
							liveResolved(plan, blocker) ? (
								t("blocked.unlink")
							) : (
								<TextButton variant="inherit" onClick={() => void actions.unlink(blocker)}>
									{t("blocked.unlink")}
								</TextButton>
							)
						}
					/>
				)}
				{firstTrashed && (
					<ChangeLine
						what={`${t("blocked.trashed", { count: blocker.trashed.length })} · ${firstTrashed.title || tc("untitled")}${
							blocker.trashed.length > 1 ? ` ${t("blocked.more", { count: blocker.trashed.length - 1 })}` : ""
						}`}
						tone={trashedResolved(plan, blocker) ? "default" : "warning"}
						then={
							trashedResolved(plan, blocker) ? (
								t("blocked.together")
							) : (
								<TextButton variant="inherit" onClick={() => actions.deleteTogether(blocker)}>
									{t("blocked.together")}
								</TextButton>
							)
						}
					/>
				)}
			</ChangeLines>
			<ChangeNote>{t("blocked.note", { collection, title })}</ChangeNote>
		</ChangeGroup>
	);
}

/**
 * The question before a permanent delete. Plain: it cannot be undone, and an address that was published stays reserved. When entries point at what is
 * deleted, the same dialog lists them per unit with the way out of each (unlink, or delete together), and the delete stays off until none is left.
 */
export function DeleteDialog({ actions }: { actions: TrashActions }) {
	const site = useSite();
	const t = useTranslator(trashMessages);
	const tc = useTranslator(commonMessages);
	const { plan } = actions;
	const blocked = plan !== null && plan.blockers.length > 0;
	const [only] = plan?.items ?? [];
	const single = plan?.items.length === 1 && only !== undefined;
	const address = single ? addressOf(only) : undefined;
	const name = single ? titleOf(site, only) : "";
	const first = plan?.blockers[0];
	const title = !blocked
		? t("delete.title")
		: plan.blockers.length === 1 && first
			? t("delete.titleOne", { title: titleOf(site, first.item) })
			: t("delete.title");
	return (
		<AlertDialog open={plan !== null} onOpenChange={(open) => !open && actions.cancelDelete()}>
			<AlertDialogContent size={blocked ? "wide" : "default"}>
				{plan && (
					<>
						<AlertDialogHeader>
							<AlertDialogTitle>{title}</AlertDialogTitle>
							{!blocked && (
								<AlertDialogDescription>
									{single ? t("delete.textOne", { title: name }) : t("delete.textMany", { count: plan.items.length })}
									{single && address && keepsAddress(plan.items) ? t("delete.keptAddress", { address }) : ""}
								</AlertDialogDescription>
							)}
							{blocked &&
								plan.blockers.map((blocker) => (
									<BlockerGroup key={itemKey(blocker.item)} blocker={blocker} plan={plan} actions={actions} />
								))}
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
							<AlertDialogAction
								variant="danger"
								disabled={!canDelete(plan) || actions.deleting}
								onClick={() => void actions.confirmDelete()}
							>
								{tc("lifecycle.deletePermanently")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</>
				)}
			</AlertDialogContent>
		</AlertDialog>
	);
}

/** The question before the trash is emptied: how many go, and that what is pointed at stays with its reason. */
export function EmptyDialog({ actions, total }: { actions: TrashActions; total: number }) {
	const t = useTranslator(trashMessages);
	const tc = useTranslator(commonMessages);
	return (
		<AlertDialog open={actions.emptyOpen} onOpenChange={(open) => !open && actions.closeEmpty()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("empty.title")}</AlertDialogTitle>
					<AlertDialogDescription>{t("empty.text", { count: total })}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
					<AlertDialogAction variant="danger" onClick={() => void actions.confirmEmpty()}>
						{t("empty.confirm")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
