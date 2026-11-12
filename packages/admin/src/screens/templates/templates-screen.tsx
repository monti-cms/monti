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
} from "@monti-cms/ui";
import { Add } from "@monti-cms/ui/icons";
import type { ReactNode } from "react";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";

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
	const list = useRead<TemplateRow[]>("templates.list", {}, { afterWrites: true });
	const duplicate = useOperation("templates.duplicate");
	const remove = useOperation("templates.remove");
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
												<DropdownMenuItem onClick={() => void duplicate.run({ id: template.id })}>
													{t("templates.duplicate")}
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem variant="danger" onClick={() => void remove.run({ id: template.id })}>
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
