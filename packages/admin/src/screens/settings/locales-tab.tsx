import {
	Box,
	Button,
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
	DragHandle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	IconButton,
	LanguageRow,
	LanguageSource,
	MenuShortcut,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Section,
	Sortable,
	SortableList,
	Stack,
	Text,
	TextButton,
	useSortableItem,
} from "@monti-cms/ui";
import { Close } from "@monti-cms/ui/icons";
import { type ComponentProps, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { findLanguages, languageName } from "./language-catalog";
import { at, type DraftLocale, type LocaleRow } from "./schema-draft";
import type { SettingsDraft } from "./use-settings-draft";

/** A language's row that can be dragged to a new place by its handle. */
function MovableRow({
	code,
	moveLabel,
	...row
}: Omit<ComponentProps<typeof LanguageRow>, "handle" | "handled" | "drag" | "ref"> & { moveLabel: string }) {
	const item = useSortableItem(code);
	return (
		<LanguageRow
			ref={item.ref}
			code={code}
			handled
			handle={<DragHandle {...item.handle} aria-label={moveLabel} />}
			drag={{ ...item.motion, active: item.held }}
			{...row}
		/>
	);
}

/** "+ Add a language": a search of the language codes (flow 11, steps 05 and 06). Picking one adds its row at once, named by its code. */
function AddLanguage({ taken, onAdd }: { taken: string[]; onAdd: (code: string, name: string) => void }) {
	const { t, language } = useAdmin();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const found = findLanguages(query, language, taken);
	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setQuery("");
			}}
		>
			<PopoverTrigger
				render={
					<Button variant="ghost" size="sm">
						{t("settings.locales.add")}
					</Button>
				}
			/>
			<PopoverContent padding="menu" align="start">
				<Command shouldFilter={false}>
					<CommandInput placeholder={t("settings.locales.search")} value={query} onValueChange={setQuery} />
					<CommandList aria-label={t("settings.locales.found")}>
						<CommandEmpty>{t("settings.locales.none")}</CommandEmpty>
						{found.map((each) => (
							<CommandItem
								key={each.code}
								value={each.code}
								onSelect={() => {
									onAdd(each.code, each.name);
									setOpen(false);
									setQuery("");
								}}
							>
								{each.name}
								{each.label !== each.name ? (
									<Text variant="note" tone="subtle">
										{each.label}
									</Text>
								) : null}
								<MenuShortcut>{each.code}</MenuShortcut>
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

/**
 * Settings › languages (doc 04, flow 11 steps 05–08 and 16): the site's content languages, the source first. A language is added by its code,
 * taken out with its ×, moved by its handle, and another one made the source; all of it waits in the draft and is saved through the review. On the
 * live site the list is the schema file's, so it is read-only with a lock on every row.
 */
export function LocalesTab({ model }: { model: SettingsDraft }) {
	const { t, language } = useAdmin();
	const { draft, data, locales: rows } = model;
	const locked = model.locked;
	const live = rows.filter((row) => row.state !== "gone");
	const movable = rows.filter((row) => !row.source);
	const sourceCell = draft.cell(at.localeSource);
	const sourceWas = data?.schema.locales.source;
	const sourceMoved = rows.some((row) => row.source && row.code !== sourceWas);

	/** What a row's dot says, and whose change it is. */
	const mark = (row: LocaleRow): { dot?: string; dotTone?: "proposal" } => {
		const cell = draft.cell(at.locale(row.code));
		const proposed =
			cell.kind === "proposed" || ((row.source || row.code === sourceWas) && sourceCell.kind === "proposed");
		const tone = proposed ? { dotTone: "proposal" as const } : {};
		if (row.state === "added") return { dot: t("changes.new"), ...tone };
		if (row.state === "gone") return { dot: t("changes.removed"), ...tone };
		if (sourceMoved && (row.source || row.code === sourceWas)) return { dot: t("changes.source"), ...tone };
		return {};
	};
	const label = (row: LocaleRow) => languageName(row.code, language);

	const remove = (row: LocaleRow) => {
		// A language added in this draft just goes; a saved one stays as a struck row until the save.
		if (row.state === "added" && draft.cell(at.locale(row.code)).kind !== "proposed") model.revertLocale(row.code);
		else draft.set(at.locale(row.code), null);
	};
	const move = (from: string, to: string) => {
		const codes = movable.map((row) => row.code);
		const [moved] = codes.splice(codes.indexOf(from), 1);
		if (!moved) return;
		codes.splice(
			movable.findIndex((row) => row.code === to),
			0,
			moved,
		);
		model.setLocaleOrder(codes);
	};

	const row = (each: LocaleRow) => {
		const shared = { name: each.name, label: label(each), gone: each.state === "gone", ...mark(each) };
		if (locked)
			return (
				<LanguageRow key={each.code} code={each.code} {...shared} locked={t("settings.locked")}>
					{each.source ? <LanguageSource flag={t("settings.locales.source")} /> : null}
				</LanguageRow>
			);
		if (each.source)
			return (
				<LanguageRow key={each.code} code={each.code} handled {...shared}>
					<LanguageSource flag={t("settings.locales.source")}>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button variant="ghost" size="sm">
										{t("settings.locales.changeSource")}
									</Button>
								}
							/>
							<DropdownMenuContent align="end">
								<DropdownMenuRadioGroup
									aria-label={t("settings.locales.sourceMenu")}
									value={each.code}
									onValueChange={(code) => draft.set(at.localeSource, String(code))}
								>
									{live.map((option) => (
										<DropdownMenuRadioItem key={option.code} value={option.code}>
											{option.name}
											<MenuShortcut>{option.code}</MenuShortcut>
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</LanguageSource>
				</LanguageRow>
			);
		return (
			<MovableRow
				key={each.code}
				code={each.code}
				moveLabel={t("settings.locales.move", { name: each.name })}
				{...shared}
			>
				{each.state === "gone" ? (
					<TextButton variant="underline" quiet size="caption" onClick={() => model.revertLocale(each.code)}>
						{t("settings.undo")}
					</TextButton>
				) : (
					<IconButton label={t("settings.locales.remove", { name: each.name })} onClick={() => remove(each)}>
						<Close aria-hidden />
					</IconButton>
				)}
			</MovableRow>
		);
	};

	return (
		<Section title={t("settings.locales.section")} last>
			<Stack gap={0}>
				<Sortable
					nameOf={(code) => rows.find((each) => each.code === code)?.name ?? code}
					onDrop={({ active, over }) => {
						if (over && active.id !== over.id) move(active.id, over.id);
					}}
				>
					<Box as="ul" aria-label={t("settings.locales.section")}>
						<SortableList id="languages" items={locked ? [] : movable.map((each) => each.code)}>
							{rows.map(row)}
						</SortableList>
					</Box>
				</Sortable>
				{locked ? null : (
					<Box paddingTop={12}>
						<AddLanguage
							taken={rows.map((each) => each.code)}
							onAdd={(code, name) => draft.set(at.locale(code), { name } satisfies DraftLocale)}
						/>
					</Box>
				)}
			</Stack>
		</Section>
	);
}
