"use client";

import { type ApiKeyView, useTranslator } from "@monti-cms/core/site";
import { useId } from "react";
import { useApiKeys } from "../../api/api-keys";
import { cn } from "../../lib/utils/cn";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { apiKeysMessages } from "./messages";

/**
 * What a form picks for the API key of one place (an AI connection, the spell checker, git sync). `saved` uses a key of the store, `new` saves the value as a
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
	className,
}: {
	value: ApiKeyChoice;
	onChange: (choice: ApiKeyChoice) => void;
	baseName: string;
	/** Label of the whole field. Default: "API key". */
	label?: string;
	disabled?: boolean;
	className?: string;
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
		<fieldset className={cn("flex flex-col gap-1", className)} disabled={disabled} data-testid="api-key-field">
			<legend className="mb-2 font-medium text-monti-body" id={groupId}>
				{label ?? t("field.keyLabel")}
			</legend>
			<div role="radiogroup" aria-labelledby={groupId} className="flex max-w-xl flex-col gap-1">
				<label
					className={cn(
						"flex items-start gap-2 rounded-md px-3 py-2",
						keys.length === 0 ? "opacity-60" : "cursor-pointer",
						saved && "bg-monti-hover ring-1 ring-monti-muted",
					)}
				>
					<input
						type="radio"
						name={`${groupId}-use`}
						className="mt-1"
						checked={saved}
						disabled={keys.length === 0}
						onChange={() => onChange({ use: "saved", keyId: chosen?.id ?? keys[0]?.id ?? "" })}
					/>
					<span className="flex min-w-0 flex-1 flex-col gap-2">
						<span className={cn("text-monti-body", saved && "font-medium")}>{t("field.useSaved")}</span>
						{keys.length === 0 ? (
							<span className="text-monti-caption text-monti-muted">
								{query.error ? t("field.loadFailed") : t("field.useSavedNone")}
							</span>
						) : saved ? (
							<>
								<Select
									value={value.keyId}
									onValueChange={(keyId) => typeof keyId === "string" && onChange({ use: "saved", keyId })}
									items={keys.map((key) => ({ value: key.id, label: key.name }))}
								>
									<SelectTrigger aria-label={t("field.savedPick")} className="h-9 w-full max-w-sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{keys.map((key) => (
											<SelectItem key={key.id} value={key.id}>
												<span>{key.name}</span>
												<span className="ml-2 font-mono text-monti-caption text-monti-muted">
													{key.readable ? mask(key) : t("field.unreadable")}
												</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{chosen && chosen.uses.length > 0 && (
									<span className="text-monti-caption text-monti-muted">
										{t("field.savedUsedBy", { uses: chosen.uses.map((use) => use.label).join(", ") })}
									</span>
								)}
							</>
						) : null}
					</span>
				</label>
				<label
					className={cn(
						"flex items-start gap-2 rounded-md px-3 py-2",
						canSave ? "cursor-pointer" : "opacity-60",
						value.use === "new" && "bg-monti-hover ring-1 ring-monti-muted",
					)}
				>
					<input
						type="radio"
						name={`${groupId}-use`}
						className="mt-1"
						checked={value.use === "new"}
						disabled={!canSave}
						onChange={() => onChange({ use: "new", value: "" })}
					/>
					<span className="flex min-w-0 flex-1 flex-col gap-2">
						<span className={cn("text-monti-body", value.use === "new" && "font-medium")}>{t("field.useNew")}</span>
						{value.use === "new" && (
							<>
								<Input
									type="password"
									autoComplete="off"
									aria-label={t("field.newInput")}
									className="h-9 max-w-sm font-mono text-monti-body"
									value={value.value}
									onChange={(event) => onChange({ use: "new", value: event.target.value })}
								/>
								<span className="text-monti-caption text-monti-muted">
									{t("field.newHelp", { name: freeName(baseName, keys) })}
								</span>
							</>
						)}
						{!canSave && <span className="text-monti-caption text-monti-muted">{t("field.secretMissing")}</span>}
					</span>
				</label>
			</div>
		</fieldset>
	);
}
