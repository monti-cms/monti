import type { ConversationOutcome } from "@monti-cms/ai";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Empty,
	Inline,
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
import { useId } from "react";
import { useAdmin } from "../operations/admin-context";
import { PickOne } from "../screens/settings/pick-one";
import { useAssistant } from "./use-assistant";
import { clock } from "./words";

/** For how many days a conversation nobody opens is kept; `never` keeps it. */
const KEEP = ["7", "30", "90", "never"] as const;

/**
 * The past conversations (doc 10): the shared table's two-line rows, as the tools' lists draw theirs. What was asked first, and under it when and
 * what came of it; the one open now is the picked row; deleting is in the row's ⋯ and is not asked about. There are no groups by day: the
 * time on each row says it.
 */
export function History() {
	const { t } = useAdmin();
	const { history, conversationId, openConversation, removeConversation, loadHistory } = useAssistant();
	// Nothing is drawn while it is read: the read is short.
	if (!history) return null;
	if (history.rows.length === 0)
		return (
			<Stack paddingX={24} minWidth={0}>
				<Empty title={t("history.none")} />
			</Stack>
		);
	const outcomeOf = (outcome: ConversationOutcome | null) =>
		outcome === null
			? null
			: outcome.kind === "applied" || outcome.kind === "taken"
				? t(`history.${outcome.kind}`, { count: outcome.count })
				: t(`history.${outcome.kind}`);
	return (
		<Stack
			gap={0}
			grow
			minHeight={0}
			padding={12}
			overflow="y"
			onScroll={(event) => {
				// At the foot of the list, the conversations before these come in.
				const box = event.currentTarget;
				if (history.more && box.scrollTop + box.clientHeight >= box.scrollHeight - 1) void loadHistory(true);
			}}
		>
			<Table container="none" aria-label={t("panel.history")}>
				<TableBody>
					{history.rows.map((row) => {
						const outcome = outcomeOf(row.outcome);
						return (
							<TableRow key={row.id} twoLine selected={row.id === conversationId}>
								<TableCell truncate>
									<Stack gap={4} minWidth={0}>
										<RowLink render={<button type="button" />} onClick={() => void openConversation(row.id)}>
											<Text truncate>{row.title}</Text>
										</RowLink>
										<Text as="div" variant="note" tone="subtle" truncate>
											{outcome ? `${clock(row.at)} · ${outcome}` : clock(row.at)}
										</Text>
									</Stack>
								</TableCell>
								<TableCell align="end">
									<RowActions>
										<DropdownMenu>
											<RowMore
												label={t("history.more", { name: row.title })}
												trigger={(button) => <DropdownMenuTrigger render={button} />}
											/>
											<DropdownMenuContent align="end">
												<DropdownMenuItem variant="danger" onClick={() => void removeConversation(row.id)}>
													{t("history.remove")}
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</RowActions>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</Stack>
	);
}

/** The foot of the past conversations: for how long one nobody opens is kept. It is saved as it is picked. */
export function HistoryFoot() {
	const { t } = useAdmin();
	const { state, setKeepDays } = useAssistant();
	const label = useId();
	if (!state) return null;
	return (
		<Inline gap={12} align="center" justify="between" grow>
			<Text id={label} variant="note">
				{t("history.keep")}
			</Text>
			<PickOne
				label={t("history.keep")}
				size="sm"
				width="fit"
				items={KEEP.map((value) => ({
					value,
					label: value === "never" ? t("history.keep.never") : t("history.keep.days", { days: value }),
				}))}
				value={state.keepDays === null ? "never" : String(state.keepDays)}
				onChange={(value) => void setKeepDays(value === "never" ? null : Number(value))}
			/>
		</Inline>
	);
}
