"use client";

import { cmsFetch, errorText } from "@monti-cms/admin/api";
import {
	Alert,
	AlertDescription,
	API_KEYS_KEY,
	type ApiKeyChoice,
	ApiKeyField,
	Button,
	choiceReady,
	Skeleton,
} from "@monti-cms/admin/kit";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BAREUN_SETTINGS_ROUTE } from "./options";
import { pageMessages } from "./page.messages";
import type { BareunSettingsView } from "./settings";

const SETTINGS_KEY = ["cms", "bareun", "settings"] as const;

/** The Spell check Tools page: which API key Bareun uses. The framing (sidebar, title) comes from the admin. */
export function SpellCheckPage() {
	const site = useSite();
	const t = useTranslator(pageMessages);
	const queryClient = useQueryClient();
	const url = cmsApiUrl(`/${BAREUN_SETTINGS_ROUTE}`);
	const [draft, setDraft] = useState<ApiKeyChoice | null>(null);

	const settings = useQuery({
		queryKey: SETTINGS_KEY,
		queryFn: ({ signal }) => cmsFetch<BareunSettingsView>(site, url, { signal, fallback: t("load.failed") }),
	});
	const save = useMutation({
		mutationFn: (key: ApiKeyChoice) =>
			cmsFetch<BareunSettingsView>(site, url, { method: "PUT", json: { key }, fallback: t("save.failed") }),
		onSuccess: (view) => {
			queryClient.setQueryData(SETTINGS_KEY, view);
			setDraft(null);
			toast.success(t("save.done"));
		},
		onError: (error) => toast.error(errorText(site, error, t("save.failed"))),
		// The key may be new, and the places that use a key changed.
		onSettled: () => queryClient.invalidateQueries({ queryKey: API_KEYS_KEY }),
	});

	if (settings.error && !settings.data) {
		return (
			<div className="min-h-0 flex-1 overflow-auto">
				<Alert variant="danger" className="m-5 w-auto">
					<AlertDescription className="col-start-auto">
						{errorText(site, settings.error, t("load.failed"))}
					</AlertDescription>
				</Alert>
			</div>
		);
	}
	if (!settings.data) {
		return (
			<div className="min-h-0 flex-1 overflow-auto">
				<Skeleton className="m-5 h-24 max-w-xl" />
			</div>
		);
	}

	const current = settings.data.key;
	const choice: ApiKeyChoice = draft ?? (current ? { use: "saved", keyId: current.id } : { use: "new", value: "" });
	const changed = draft !== null && !(draft.use === "saved" && draft.keyId === current?.id);

	return (
		<div className="min-h-0 flex-1 overflow-auto">
			<form
				className="max-w-2xl space-y-5 p-5"
				onSubmit={(event) => {
					event.preventDefault();
					if (changed && choiceReady(choice)) save.mutate(choice);
				}}
			>
				<p className="text-cms-muted-foreground text-sm">{t("description")}</p>
				<ApiKeyField value={choice} onChange={setDraft} baseName="Bareun" disabled={save.isPending} />
				<Button type="submit" size="sm" disabled={!changed || !choiceReady(choice) || save.isPending}>
					{t("save.label")}
				</Button>
			</form>
		</div>
	);
}
