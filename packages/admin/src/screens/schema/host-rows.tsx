"use client";

import { useTranslator } from "@monti-cms/core/site";
import { Box, FormFieldError, Inline, Input, Stack, TextButton } from "@monti-cms/ui";
import { useId, useRef, useState } from "react";
import { Labeled } from "../shared/labeled";
import { useFieldChange, useSchemaEdit } from "./controls";
import { sameJson } from "./schema-model";
import { schemaSiteMessages } from "./site.messages";
import { problemAt } from "./site-problems";

interface Row {
	readonly id: number;
	readonly value: string;
}

/**
 * The other host names of the site, edited in place: one mono input per host with a quiet × that takes it out, and "add host" that adds an empty row and puts
 * the caret in it. An empty row is not written to the file. `onChange` gets the filled-in names; when they change from outside (a revert) the rows follow.
 */
export function HostRows({
	hosts,
	onChange,
	revert,
}: {
	/** The names in the draft. */
	hosts: readonly string[];
	onChange: (hosts: string[]) => void;
	/** Puts the saved names back; given only while they differ from the saved file. */
	revert?: () => void;
}) {
	const t = useTranslator(schemaSiteMessages);
	const { disabled, problems } = useSchemaEdit();
	const errorId = useId();
	const counter = useRef(0);
	const make = (values: readonly string[]): Row[] => values.map((value) => ({ id: counter.current++, value }));
	const [rows, setRows] = useState<Row[]>(() => make(hosts));
	const [focusId, setFocusId] = useState<number | null>(null);
	const changed = useFieldChange(t("site.aliases"), revert);
	const filled = rows.map((row) => row.value.trim()).filter((value) => value !== "");
	// The names changed outside this list (reverted, discarded): the rows show them.
	if (!sameJson(filled, hosts)) setRows(make(hosts));
	const commit = (next: Row[]) => {
		setRows(next);
		onChange(next.map((row) => row.value.trim()).filter((value) => value !== ""));
	};
	const add = () => {
		const row = { id: counter.current++, value: "" };
		setRows([...rows, row]);
		setFocusId(row.id);
	};
	return (
		<Labeled label={t("site.aliases")} changed={changed}>
			<Stack gap={2}>
				{rows.map((row, index) => {
					const name = row.value.trim();
					const at = name === "" ? -1 : rows.slice(0, index).filter((item) => item.value.trim() !== "").length;
					const problem = at === -1 ? undefined : problemAt(problems, `site.aliases.${at}`);
					return (
						<Stack key={row.id} gap={2}>
							<Inline gap={12}>
								<Input
									mono
									value={row.value}
									disabled={disabled}
									autoFocus={row.id === focusId}
									placeholder="blog.example.dev"
									aria-label={t("site.alias.row", { number: index + 1 })}
									aria-invalid={problem ? true : undefined}
									aria-describedby={problem ? `${errorId}-${row.id}` : undefined}
									onChange={(event) =>
										commit(rows.map((item) => (item.id === row.id ? { ...item, value: event.target.value } : item)))
									}
								/>
								{!disabled && (
									<TextButton
										variant="quiet"
										aria-label={name === "" ? t("site.alias.removeNew") : t("site.alias.remove", { name })}
										onClick={() => commit(rows.filter((item) => item.id !== row.id))}
									>
										×
									</TextButton>
								)}
							</Inline>
							{problem && <FormFieldError id={`${errorId}-${row.id}`}>{t("problem.host")}</FormFieldError>}
						</Stack>
					);
				})}
				{!disabled && (
					<Box paddingTop={8}>
						<TextButton onClick={add}>{t("site.alias.add")}</TextButton>
					</Box>
				)}
			</Stack>
		</Labeled>
	);
}
