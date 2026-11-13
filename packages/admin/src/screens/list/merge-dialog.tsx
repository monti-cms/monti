import type { MergeResult, UsageItem } from "@monti-cms/core";
import {
	Button,
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	FormFieldError,
	RadioGroup,
	RadioItem,
	Text,
	toast,
} from "@monti-cms/ui";
import { useEffect, useId, useMemo, useState } from "react";
import { useUndo } from "../../activity/use-undo";
import { useAdmin } from "../../operations/admin-context";
import { reasonOf, useOperation } from "../../operations/use-operation";
import { endsClosed, endsDirectionClosed } from "./format";

export type MergeDialogProps = {
	collection: string;
	collectionLabel: string;
	collectionPath?: string;
	groups: string[];
	items: UsageItem[];
	open: boolean;
	onClose: () => void;
	onMerged?: (affectedCount: number, intoTitle: string) => void;
};

/**
 * Dialog to merge multiple items in a taxonomy into one surviving item (doc 08, flow 7 step 08).
 * Defaults to keeping the item with the higher post count and reports affected posts/removed URLs.
 */
export function MergeDialog({
	collection,
	collectionLabel,
	collectionPath,
	groups,
	items,
	open,
	onClose,
	onMerged,
}: MergeDialogProps) {
	const { t } = useAdmin();
	const mergeOp = useOperation<{
		output: MergeResult;
		activityId?: string;
	}>("relations.merge");
	const undo = useUndo();

	const choosingTarget = groups.length === 1;
	const sourceItem = choosingTarget ? items.find((item) => item.group === groups[0]) : undefined;
	const selectedItems = useMemo(() => items.filter((item) => groups.includes(item.group)), [items, groups]);
	const choices = useMemo(
		() => (choosingTarget ? items.filter((item) => item.group !== sourceItem?.group) : selectedItems),
		[choosingTarget, items, selectedItems, sourceItem?.group],
	);

	const defaultInto = useMemo(() => {
		if (choosingTarget) return "";
		const sorted = [...selectedItems].sort((a, b) => b.usageCount - a.usageCount);
		return sorted[0]?.group ?? "";
	}, [choosingTarget, selectedItems]);

	const [intoGroup, setIntoGroup] = useState<string>(defaultInto);

	/** "Merge" was pressed with nothing picked to keep: the choices say so (button.md: the button stays pressable). */
	const [unpicked, setUnpicked] = useState(false);
	const errorId = useId();

	useEffect(() => {
		if (open) {
			setIntoGroup(defaultInto);
			setUnpicked(false);
		}
	}, [open, defaultInto]);

	const intoItem = items.find((item) => item.group === intoGroup);
	const fromItems = useMemo(
		() =>
			choosingTarget ? (sourceItem ? [sourceItem] : []) : selectedItems.filter((item) => item.group !== intoGroup),
		[choosingTarget, sourceItem, selectedItems, intoGroup],
	);
	const fromGroups = useMemo(() => fromItems.map((i) => i.group), [fromItems]);

	const affectedCount = fromItems.reduce((sum, i) => sum + i.usageCount, 0);
	const intoTitle = intoItem?.title ?? intoGroup;

	const removedUrls = collectionPath
		? fromItems
				.flatMap((i) => Object.values(i.locales).map((l) => (l.slug ? collectionPath.replace(":slug", l.slug) : "")))
				.filter(Boolean)
		: [];
	const description = intoItem
		? fromItems.length === 1
			? t("taxonomy.mergePreviewOne", {
					count: affectedCount,
					from: fromItems[0]?.title ?? "",
					into: intoTitle,
				})
			: t("taxonomy.mergePreviewMany", {
					count: affectedCount,
					into: intoTitle,
					itemCount: fromItems.length,
				})
		: t("taxonomy.mergeTargetDescription", { from: sourceItem?.title ?? "" });

	const handleMerge = async () => {
		if (!intoGroup || fromGroups.length === 0) return setUnpicked(true);
		const res = await mergeOp.run({
			collection,
			intoGroup,
			fromGroups,
		});
		if (!res.ok) toast.error(t(reasonOf(res.refusal)));
		else {
			const out = res.body.output;
			const finalCount = out?.affectedCount ?? affectedCount;
			const finalTitle = out?.intoTitle ?? intoTitle;
			toast(
				t("taxonomy.mergedToast", {
					count: finalCount,
					collectionObject: t(endsClosed(collectionLabel) ? "list.objectFinal" : "list.objectOpen", {
						name: collectionLabel,
					}),
					intoDirection: t(endsDirectionClosed(finalTitle) ? "list.toFinal" : "list.toOpen", { name: finalTitle }),
				}),
				{
					action: res.body.activityId
						? {
								label: t("common.undo"),
								onClick: () => void (res.body.activityId && undo.run(res.body.activityId)),
							}
						: undefined,
				},
			);
			onMerged?.(finalCount, finalTitle);
			onClose();
		}
	};

	return (
		<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{t(choosingTarget ? "taxonomy.mergeTargetDialogTitle" : "taxonomy.mergeDialogTitle")}
					</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
					{intoItem && removedUrls.length > 0 && (
						<Text as="p" variant="note" tone="faint">
							{t("taxonomy.mergeRemovedUrls", { urls: removedUrls.join(", ") })}
						</Text>
					)}
				</DialogHeader>
				<RadioGroup
					value={intoGroup}
					aria-invalid={unpicked && !intoGroup ? true : undefined}
					aria-describedby={unpicked && !intoGroup ? errorId : undefined}
					onValueChange={(val) => setIntoGroup(val)}
				>
					{choices.map((item) => {
						const slug = Object.values(item.locales)[0]?.slug;
						return (
							<RadioItem
								key={item.group}
								value={item.group}
								label={slug ? `${item.title} ${slug}` : item.title}
								hint={t("taxonomy.usageCount", { count: item.usageCount })}
							/>
						);
					})}
				</RadioGroup>
				{unpicked && !intoGroup && <FormFieldError id={errorId}>{t("taxonomy.mergePick")}</FormFieldError>}
				<DialogFooter>
					<DialogClose render={<Button variant="ghost" />}>{t("ui.cancel")}</DialogClose>
					<Button variant="primary" loading={mergeOp.pending} onClick={() => void handleMerge()}>
						{t("taxonomy.mergeAction")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
