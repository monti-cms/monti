import type { BackupOutput } from "@monti-cms/core";
import {
	Button,
	Checkbox,
	Inline,
	Option,
	PageBody,
	PageColumn,
	PageHeader,
	Section,
	Stack,
	Text,
	toast,
} from "@monti-cms/ui";
import { type ReactNode, useState } from "react";
import { saveBackup } from "../../download";
import { formatBytes } from "../../media/file-text";
import { useAdmin } from "../../operations/admin-context";
import { reasonOf, useOperation, useRead } from "../../operations/use-operation";

type Status = { lastBackup: string | null; mediaFiles: number; mediaBytes: number; storage: boolean };

/** When a backup was taken, as the page says it: the time today, else the day. */
function when(at: string, language: string): string {
	const date = new Date(at);
	const today = new Date();
	const sameDay = date.toDateString() === today.toDateString();
	return sameDay
		? new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)
		: `${String(date.getMonth() + 1).padStart(2, "0")}. ${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Tools › data (tools.md, doc 14): the backup. What goes into it is chosen before the pill that takes it; the pill makes the file at once and
 * says how far it is. Importing is not here: it starts from a collection's list.
 */
export function DataScreen({ tabs }: { tabs: ReactNode }) {
	const { t, language } = useAdmin();
	const status = useRead<Status>("data.status", {}, { afterWrites: true });
	const backup = useOperation<BackupOutput>("data.backup");
	const note = useOperation("data.backedUp");
	const [media, setMedia] = useState(false);
	/** How far the file is, 0 to 100, while it is made. */
	const [making, setMaking] = useState<number | null>(null);

	const take = async () => {
		if (making !== null) return;
		setMaking(0);
		try {
			const read = await backup.run({});
			if (!read.ok) return void toast.error(t(reasonOf(read.refusal)));
			const { missing } = await saveBackup(read.body, {
				media,
				onProgress: (share) => setMaking(Math.round(share * 100)),
			});
			// A backup that lacks files is saved and said to lack them; it is not the site's last backup.
			if (missing > 0) return void toast.error(t("data.backup.missing", { count: missing }));
			await note.run({});
			toast(t("data.backup.saved"));
		} catch {
			toast.error(t({ key: "errors.unexpected" }));
		} finally {
			setMaking(null);
		}
	};

	return (
		<PageColumn width="content">
			<PageHeader title={t("tools.title")} />
			{tabs}
			{status.data ? (
				<PageBody>
					<Section title={t("data.backup")} last>
						<Stack gap={12}>
							{/* A site with no storage has no files to put in: the choice is not offered. */}
							{status.data.storage && status.data.mediaFiles > 0 ? (
								<Option>
									<Checkbox
										checked={media}
										disabled={making !== null}
										onCheckedChange={(next) => setMedia(next === true)}
									/>
									{t("data.backup.media")}
									<Text variant="meta" tone="subtle">
										{formatBytes(status.data.mediaBytes)}
									</Text>
								</Option>
							) : null}
							<Inline gap={16}>
								<Button variant="primary" loading={making !== null} onClick={() => void take()}>
									{making === null ? t("data.backup.take") : t("data.backup.making", { percent: making })}
								</Button>
								<Text as="span" variant="note" tone="subtle">
									{t("data.backup.last")}{" "}
									{status.data.lastBackup ? (
										<Text mono>{when(status.data.lastBackup, language)}</Text>
									) : (
										t("data.backup.never")
									)}
								</Text>
							</Inline>
						</Stack>
					</Section>
				</PageBody>
			) : null}
		</PageColumn>
	);
}
