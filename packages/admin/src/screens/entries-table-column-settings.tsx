// "Column settings" popover of the entries table: show/hide and reorder columns.
import { useSite, useTranslator } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, Columns3 } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { IconButton } from "../ui/icon-button";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { type AdminListColumn, columnLabel } from "./list-columns";
import { screensMessages } from "./messages";

export function ColumnSettingsPopover({
	collection,
	order,
	visibility,
	onToggle,
	onMove,
}: {
	collection: string;
	order: AdminListColumn[];
	visibility: Record<string, boolean>;
	onToggle: (column: AdminListColumn, visible: boolean) => void;
	onMove: (column: AdminListColumn, direction: -1 | 1) => void;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	return (
		<Popover>
			<PopoverTrigger render={<Button type="button" variant="ghost" size="xs" className="text-cms-muted-foreground" />}>
				<Columns3 aria-hidden />
				{t("list.columnSettings")}
			</PopoverTrigger>
			<PopoverContent align="end" className="w-64 p-3">
				<ul className="space-y-1">
					{order.map((column, index) => (
						<li key={column} className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-cms-accent">
							<Label className="font-normal">
								<Checkbox
									checked={visibility[column] ?? false}
									disabled={column === "title"}
									onCheckedChange={(checked) => onToggle(column, checked === true)}
								/>
								{columnLabel(site, collection, column)}
							</Label>
							<span className="flex gap-1">
								<IconButton
									size="icon-xs"
									variant="outline"
									label={t("list.columnUp", { label: columnLabel(site, collection, column) })}
									disabled={index === 0}
									onClick={() => onMove(column, -1)}
								>
									<ArrowUp aria-hidden />
								</IconButton>
								<IconButton
									size="icon-xs"
									variant="outline"
									label={t("list.columnDown", { label: columnLabel(site, collection, column) })}
									disabled={index === order.length - 1}
									onClick={() => onMove(column, 1)}
								>
									<ArrowDown aria-hidden />
								</IconButton>
							</span>
						</li>
					))}
				</ul>
			</PopoverContent>
		</Popover>
	);
}
