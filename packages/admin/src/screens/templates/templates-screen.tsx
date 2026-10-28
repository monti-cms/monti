"use client";

import { Add } from "@carbon/icons-react";
import type { BodyTemplate } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	Count,
	RowActions,
	RowLink,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
} from "@monti-cms/ui";
import { useQuery } from "@tanstack/react-query";
import { errorText } from "../../api/client";
import { listTemplates, templatesKeys } from "../../api/templates";
import { commonMessages } from "../../lib/common.messages";
import { AdminLink as Link, useAdminRouter } from "../../router";
import { shortDate } from "../list-row-dates";
import { ActionContextMenu, MoreActionsButton } from "../shared/action-menu";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { ToolsFrame } from "../tools/tools-frame";
import { templatesMessages } from "./messages";
import { editTemplateHref, newTemplateHref } from "./template-hrefs";
import { sectionsLine } from "./template-model";
import { useTemplateActions } from "./use-template-actions";

/** Width of the last two columns: the day it was edited, and the `⋯`. */
const DATE_SIZE = 120;
const ACTIONS_SIZE = 56;

/**
 * Tools › Templates: a row per template (its name as the way into its page, its sections under it, the day it was edited, a `⋯` with duplicate and
 * delete), and "Add template" in the page header. A template opens on a page of its own. `now` is the day the dates are read against (a story fixes it).
 */
export function TemplatesScreen({ now }: { now?: Date } = {}) {
	const site = useSite();
	const t = useTranslator(templatesMessages);
	const tc = useTranslator(commonMessages);
	const router = useAdminRouter();
	// With a cache, the list shows at once and refetches in the background.
	const query = useQuery({
		queryKey: templatesKeys.list(),
		queryFn: ({ signal }) => listTemplates(site, signal, t("list.loadFailed")),
	});
	const templates = query.data ?? [];
	const error = query.error && !query.data ? errorText(site, query.error, t("list.loadFailed")) : null;
	const { menu, dialog } = useTemplateActions();

	return (
		<ToolsFrame
			tab="templates"
			count={query.data ? templates.length : undefined}
			actions={
				<Button type="button" onClick={() => router.navigate(newTemplateHref(site))}>
					<Add aria-hidden />
					{t("add")}
				</Button>
			}
		>
			<Stack as="section" aria-label={t("list.label")} gap={0} grow minHeight={0}>
				{error && (
					<Box paddingTop={12}>
						<LoadErrorAlert message={error} onRetry={() => void query.refetch()} />
					</Box>
				)}
				{templates.length > 0 ? (
					<Table container="none" layout="fixed" columns={[undefined, DATE_SIZE, ACTIONS_SIZE]}>
						<TableBody>
							{templates.map((template: BodyTemplate) => {
								const sections = sectionsLine(template.doc);
								return (
									<ActionContextMenu key={template.id} actions={menu(template)} trigger={<TableRow />}>
										<TableCell>
											<Stack as="span" gap={4} minWidth={0}>
												<Text as="span" truncate>
													<RowLink render={<Link href={editTemplateHref(site, template.id)} />}>
														{template.name}
													</RowLink>
												</Text>
												{sections && (
													<Text as="span" variant="note" tone="subtle" truncate>
														{sections}
													</Text>
												)}
											</Stack>
										</TableCell>
										<TableCell align="end">
											<Count>{t("row.edited", { date: shortDate(site, template.updatedAt, now) })}</Count>
										</TableCell>
										<TableCell align="end">
											<RowActions>
												<MoreActionsButton actions={menu(template)} label={t("row.more")} />
											</RowActions>
										</TableCell>
									</ActionContextMenu>
								);
							})}
						</TableBody>
					</Table>
				) : (
					!error &&
					!query.isPending && (
						<Box paddingY={40} border="top">
							<Text as="p" variant="note" tone="subtle" align="center">
								{t("list.empty")}
							</Text>
						</Box>
					)
				)}
				{query.isPending && (
					<Text as="p" variant="note" tone="subtle" role="status">
						{tc("loading")}
					</Text>
				)}
			</Stack>
			{dialog}
		</ToolsFrame>
	);
}
