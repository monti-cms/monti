import type { TrashedEntry } from "@monti-cms/core";
import {
	Button,
	DescriptionItem,
	DescriptionList,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	FileUseList,
	FileUseRow,
	FormField,
	FormFieldLabel,
	IconButton,
	SidePanel,
	Stack,
} from "@monti-cms/ui";
import { OverflowMenuHorizontal, TrashCan } from "@monti-cms/ui/icons";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import { linkTo, type Route } from "../../route";
import { DaysLeftFact } from "../../trash/days-left";
import { useCoverCorner } from "../frame/admin-frame";
import { useLanguageName } from "../list/column-menu";

/**
 * An item in the trash, beside the trash's list (flow 5·19): its collection, its name and address in each language, and the entries that point at it, which show it
 * again once it is restored. Its first fact is the days it has left, as the list's column says them. To read only: restoring is its one pill, deleting it for good is in its ⋯ (doc 11).
 */
export function TrashedItemPanel({
	id,
	collectionLabel,
	onClose,
	onRestore,
	onPurge,
	go,
}: {
	id: string;
	/** What a collection is called in the admin. */
	collectionLabel: (collection: string) => string;
	onClose: () => void;
	onRestore: () => void;
	onPurge: () => void;
	go: (route: Route) => void;
}) {
	const { t } = useAdmin();
	const languageName = useLanguageName();
	const read = useRead<TrashedEntry>("trash.get", { id }, { afterWrites: true });
	const item = read.data;
	useCoverCorner(true);
	// Read again after it left the trash (restored, deleted): the answer is a refusal, and the panel has nothing to show.
	if (!item || read.refusal) return null;
	const [first] = item.locales;
	const several = item.locales.length > 1;
	return (
		<SidePanel
			width="side"
			title={first?.title ?? ""}
			onClose={onClose}
			actions={
				<DropdownMenu>
					<IconButton label={t("trash.more")} trigger={(button) => <DropdownMenuTrigger render={button} />}>
						<OverflowMenuHorizontal aria-hidden />
					</IconButton>
					<DropdownMenuContent align="end">
						<DropdownMenuItem variant="danger" onClick={onPurge}>
							<TrashCan aria-hidden />
							{t("trash.purge")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			}
			footer={
				<Button variant="primary" size="md" onClick={onRestore}>
					{t("trash.restore")}
				</Button>
			}
		>
			<Stack gap={32}>
				<DescriptionList>
					<DaysLeftFact days={item.daysLeft} />
					<DescriptionItem label={t("trash.collection")}>{collectionLabel(item.collection)}</DescriptionItem>
					{/* The panel's title is its name already: only an item with several languages lists them. */}
					{several &&
						item.locales.map((each) => (
							<DescriptionItem key={`name:${each.locale}`} label={`${t("trash.name")} · ${languageName(each.locale)}`}>
								{each.title}
							</DescriptionItem>
						))}
					{item.locales.map((each) =>
						each.address ? (
							<DescriptionItem
								key={`address:${each.locale}`}
								label={several ? `${t("trash.address")} · ${languageName(each.locale)}` : t("trash.address")}
								mono
							>
								{each.address}
							</DescriptionItem>
						) : null,
					)}
				</DescriptionList>
				<FormField>
					<FormFieldLabel>{t("trash.pointing", { count: item.pointing.length })}</FormFieldLabel>
					<FileUseList empty={t("library.usesNone")}>
						{item.pointing.map((entry) => {
							const route: Route = { screen: "entry", collection: entry.collection, id: entry.id };
							const label = collectionLabel(entry.collection);
							return (
								<FileUseRow
									key={entry.id}
									title={entry.title}
									places={entry.trashed ? t("trash.inTrash", { label }) : label}
									{...linkTo(route, go)}
								/>
							);
						})}
					</FileUseList>
				</FormField>
			</Stack>
		</SidePanel>
	);
}
