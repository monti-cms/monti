import {
	Button,
	Count,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Empty,
	PageColumn,
	PageHeader,
	RowActions,
	RowLink,
	RowMore,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	toast,
} from "@monti-cms/ui";
import { Add, Copy, TrashCan } from "@monti-cms/ui/icons";
import type { ReactNode } from "react";
import { useUndo } from "../../activity/use-undo";
import { useAdmin } from "../../operations/admin-context";
import { reasonOf, useOperation, useRead } from "../../operations/use-operation";

type TemplateRow = { id: string; name: string; sections: string[]; updatedAt: string };

/** A day as the lists write it: "10. 20" in Korean, "Oct 20" in English. */
export function shortDate(value: string, language: string) {
	const date = new Date(value);
	if (language === "ko")
		return `${String(date.getMonth() + 1).padStart(2, "0")}. ${String(date.getDate()).padStart(2, "0")}`;
	return new Intl.DateTimeFormat(language, { month: "short", day: "numeric" }).format(date);
}

/**
 * Tools › Templates (tools.md): each body template with its sections under its name, the day it was last changed, and its ⋯ (duplicate, delete).
 * `tabs` is the tools' tab row, under the title.
 */
export function TemplatesScreen({ tabs, onOpen }: { tabs: ReactNode; onOpen: (template: string | null) => void }) {
	const { t, language } = useAdmin();
	const list = useRead<TemplateRow[]>("templates.list");
	const duplicate = useOperation("templates.duplicate");
	const remove = useOperation<{ activityId?: string | null }>("templates.remove");
	const undo = useUndo();
	const copy = async (id: string) => {
		const result = await duplicate.run({ id });
		if (!result.ok) toast.error(t(reasonOf(result.refusal)));
	};
	/** Gone at once, with the activity log's undo on the toast (overlay.md: what can be undone does not ask first). */
	const drop = async (id: string) => {
		const result = await remove.run({ id });
		if (!result.ok) {
			toast.error(t(reasonOf(result.refusal)));
			return;
		}
		const activity = result.body.activityId;
		toast(t("templates.removed"), {
			action: activity ? { label: t("common.undo"), onClick: () => void undo.run(activity) } : undefined,
		});
	};
	return (
		<PageColumn width="content">
			<PageHeader title={t("tools.title")}>
				<Button variant="primary" onClick={() => onOpen(null)}>
					<Add aria-hidden />
					{t("templates.add")}
				</Button>
			</PageHeader>
			{tabs}
			{list.data && list.data.length === 0 ? <Empty title={t("templates.none")} /> : null}
			{list.data?.length ? (
				<Table container="none" aria-label={t("tools.templates")}>
					<TableBody>
						{list.data.map((template) => (
							<TableRow key={template.id} twoLine>
								<TableCell truncate>
									<Stack gap={4} minWidth={0}>
										<Text as="div" truncate>
											<RowLink render={<button type="button" onClick={() => onOpen(template.id)} />}>
												{template.name}
											</RowLink>
										</Text>
										{template.sections.length ? (
											<Text as="div" variant="note" tone="subtle" truncate>
												{template.sections.join(" · ")}
											</Text>
										) : null}
									</Stack>
								</TableCell>
								<TableCell>
									<Count>{t("templates.edited", { date: shortDate(template.updatedAt, language) })}</Count>
								</TableCell>
								<TableCell align="end">
									<RowActions>
										<DropdownMenu>
											<RowMore
												label={t("templates.more")}
												trigger={(button) => <DropdownMenuTrigger render={button} />}
											/>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onClick={() => void copy(template.id)}>
													<Copy aria-hidden />
													{t("templates.duplicate")}
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem variant="danger" onClick={() => void drop(template.id)}>
													<TrashCan aria-hidden />
													{t("templates.remove")}
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</RowActions>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : null}
		</PageColumn>
	);
}
