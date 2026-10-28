"use client";

import { type ApiKeyView, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Inline,
	Input,
	RadioGroup,
	RadioItem,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
	Text,
} from "@monti-cms/ui";
import { useId } from "react";
import { useApiKeys } from "../../api/api-keys";
import { apiKeysMessages } from "./messages";

/**
 * What a form picks for the API key of one place (an AI connection, a plugin's key slot). `saved` uses a key of the store, `new` saves the value as a
 * new key in the store (named after the place) and uses that, `none` uses no key. Sent to the plugin's route as it is; the route resolves it on the server.
 */
export type ApiKeyChoice =
	| { readonly use: "saved"; readonly keyId: string }
	| { readonly use: "new"; readonly value: string }
	| { readonly use: "none" };

/** The value that goes to the server. A new key with nothing typed is no key yet. */
export const choiceReady = (choice: ApiKeyChoice): boolean =>
	choice.use === "saved" ? choice.keyId !== "" : choice.use === "new" ? choice.value.trim() !== "" : true;

/** The name the store will give a key typed into a form: `baseName`, or `baseName 2`, ... when taken. Mirrors the server. */
function freeName(base: string, taken: readonly ApiKeyView[]): string {
	const used = new Set(taken.map((key) => key.name.toLowerCase()));
	if (!used.has(base.toLowerCase())) return base;
	for (let n = 2; ; n++) if (!used.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

/**
 * The API key field of a form: "use a saved key" (a list of the store's keys) or "enter a new key" (saved into the store). The key a place uses now is
 * `current`; `baseName` is the name a new key gets (the service or the place). No value ever comes back from the server: a saved key shows its name and last four characters.
 */
export function ApiKeyField({
	value,
	onChange,
	baseName,
	label,
	disabled,
}: {
	value: ApiKeyChoice;
	onChange: (choice: ApiKeyChoice) => void;
	baseName: string;
	/** Label of the whole field. Default: "API key". */
	label?: string;
	disabled?: boolean;
}) {
	const t = useTranslator(apiKeysMessages);
	const query = useApiKeys();
	const groupId = useId();
	const keys = query.data?.items ?? [];
	const canSave = query.data?.secretsAvailable !== false;
	const saved = value.use === "saved";
	const chosen = saved ? keys.find((key) => key.id === value.keyId) : undefined;
	const mask = (key: ApiKeyView) => (key.tail ? `••••${key.tail}` : "••••");
	return (
		<fieldset disabled={disabled} data-testid="api-key-field">
			<legend id={groupId}>
				<Text weight="medium">{label ?? t("field.keyLabel")}</Text>
			</legend>
			<Stack gap={12} paddingTop={8} maxWidth="reading">
				<RadioGroup
					aria-labelledby={groupId}
					value={value.use === "none" ? "" : value.use}
					onValueChange={(next) => {
						if (next === "saved") onChange({ use: "saved", keyId: chosen?.id ?? keys[0]?.id ?? "" });
						else if (next === "new") onChange({ use: "new", value: "" });
					}}
				>
					<RadioItem
						value="saved"
						disabled={keys.length === 0}
						label={<Text weight={saved ? "medium" : undefined}>{t("field.useSaved")}</Text>}
					/>
					<RadioItem
						value="new"
						disabled={!canSave}
						label={<Text weight={value.use === "new" ? "medium" : undefined}>{t("field.useNew")}</Text>}
					/>
				</RadioGroup>
				{/* The picked option's control and its note go under the group, as the design's change panel does: the rows hold only their labels. */}
				{saved && keys.length > 0 && (
					<Stack gap={8}>
						<Box maxWidth="assistant">
							<Select
								value={value.keyId}
								onValueChange={(keyId) => typeof keyId === "string" && onChange({ use: "saved", keyId })}
								items={keys.map((key) => ({ value: key.id, label: key.name }))}
							>
								<SelectTrigger aria-label={t("field.savedPick")} width="full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{keys.map((key) => (
										<SelectItem key={key.id} value={key.id}>
											<Inline gap={8}>
												<Text>{key.name}</Text>
												<Text variant="caption" tone="muted" mono>
													{key.readable ? mask(key) : t("field.unreadable")}
												</Text>
											</Inline>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Box>
						{chosen && chosen.uses.length > 0 && (
							<Text variant="caption" tone="muted">
								{t("field.savedUsedBy", { uses: chosen.uses.map((use) => use.label).join(", ") })}
							</Text>
						)}
					</Stack>
				)}
				{value.use === "new" && (
					<Stack gap={8}>
						<Box maxWidth="assistant">
							<Input
								type="password"
								autoComplete="off"
								aria-label={t("field.newInput")}
								mono
								value={value.value}
								onChange={(event) => onChange({ use: "new", value: event.target.value })}
							/>
						</Box>
						<Text variant="caption" tone="muted">
							{t("field.newHelp", { name: freeName(baseName, keys) })}
						</Text>
					</Stack>
				)}
				{(keys.length === 0 || !canSave) && (
					<Stack gap={8}>
						{keys.length === 0 && (
							<Text variant="caption" tone="muted">
								{query.error ? t("field.loadFailed") : t("field.useSavedNone")}
							</Text>
						)}
						{!canSave && (
							<Text variant="caption" tone="muted">
								{t("field.secretMissing")}
							</Text>
						)}
					</Stack>
				)}
			</Stack>
		</fieldset>
	);
}
