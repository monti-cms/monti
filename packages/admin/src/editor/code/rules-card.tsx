import { CODE_TEXT_EFFECTS, type CodeRule, type CodeTextEffect, ruleRanges, ruleRegex } from "@monti-cms/core/code";
import {
	Affix,
	Button,
	Command,
	CommandItem,
	CommandList,
	CommandSeparator,
	FormField,
	FormFieldDescription,
	FormFieldError,
	FormFieldLabel,
	Inline,
	Input,
	MenuValue,
	PopoverContent,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { Add, ChevronLeft, ChevronRight, TrashCan } from "@monti-cms/ui/icons";
import { useState } from "react";
import { useAdmin } from "../../operations/admin-context";

const EFFECT_LABEL: Record<CodeTextEffect, string> = {
	bold: "marks.bold",
	italic: "marks.italic",
	strike: "marks.strike",
	underline: "marks.underline",
	codeFold: "marks.codeFold",
	codeTip: "marks.codeTip",
};

/** A pattern that would find what is picked as it is written. */
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The regex rules' card (doc 17, approved 2026-11-14): the list of rules (the pattern, its effect and how many places it finds), "Add rule", and one rule
 * opened in the same card with a way back: what to find, its flags, the effect (a tooltip's words), where to look, and "Delete rule".
 */
export function RulesCard({
	anchor,
	rules,
	code,
	lineCount,
	picked,
	onChange,
}: {
	anchor: React.RefObject<HTMLDivElement | null>;
	rules: readonly CodeRule[];
	code: string;
	lineCount: number;
	/** The words picked in the code: a new rule starts by finding them. */
	picked: string;
	onChange: (rules: CodeRule[]) => void;
}) {
	const { t } = useAdmin();
	/** The rule open in the card, as typed: it is stored once it reads (an empty or broken pattern is not a rule the save takes). */
	const [open, setOpen] = useState<{ at: number; rule: CodeRule } | null>(null);
	const effectLabel = (name: CodeTextEffect) => t(EFFECT_LABEL[name]);
	const rule = open?.rule ?? null;
	const put = (next: CodeRule) => {
		if (!open) return;
		setOpen({ at: open.at, rule: next });
		if (!next.pattern || !ruleRegex(next)) return;
		onChange(open.at < rules.length ? rules.map((each, at) => (at === open.at ? next : each)) : [...rules, next]);
	};

	if (!rule || !open)
		return (
			<PopoverContent anchor={anchor} align="start" padding="menu" width="sm">
				<Command shouldFilter={false}>
					<CommandList>
						{rules.map((each, at) => (
							<CommandItem key={`${each.pattern}-${at}`} value={`${at}`} onSelect={() => setOpen({ at, rule: each })}>
								<Text mono truncate>
									{each.pattern}
								</Text>
								<MenuValue>
									{t("editor.code.ruleValue", { effect: effectLabel(each.name), n: ruleRanges(each, code).length })}
								</MenuValue>
								<ChevronRight aria-hidden />
							</CommandItem>
						))}
						{rules.length ? <CommandSeparator /> : null}
						<CommandItem
							value="add"
							onSelect={() => {
								const fresh: CodeRule = {
									scope: "document",
									name: "bold",
									pattern: picked ? escaped(picked) : "",
									flags: "g",
								};
								if (fresh.pattern) onChange([...rules, fresh]);
								setOpen({ at: rules.length, rule: fresh });
							}}
						>
							<Add aria-hidden />
							{t("editor.code.addRule")}
						</CommandItem>
					</CommandList>
				</Command>
			</PopoverContent>
		);

	const readable = rule.pattern === "" || ruleRegex(rule) !== null;
	const found = readable && rule.pattern ? ruleRanges(rule, code).length : 0;
	return (
		<PopoverContent anchor={anchor} align="start" width="md" initialFocus={false}>
			<Stack gap={16}>
				<Inline>
					<TextButton variant="quiet" size="caption" onClick={() => setOpen(null)}>
						<ChevronLeft aria-hidden />
						{t("editor.code.rules")}
					</TextButton>
				</Inline>
				<FormField>
					<FormFieldLabel>{t("editor.code.find")}</FormFieldLabel>
					<Inline gap={8}>
						<Affix
							size="md"
							prefix="/"
							suffix="/"
							autoFocus
							aria-label={t("editor.code.pattern")}
							value={rule.pattern}
							aria-invalid={!readable || undefined}
							onChange={(event) => put({ ...rule, pattern: event.currentTarget.value })}
						/>
						<Input
							size="md"
							mono
							width="fit"
							aria-label={t("editor.code.flags")}
							value={rule.flags}
							onChange={(event) => put({ ...rule, flags: event.currentTarget.value.replace(/[^dgimsuy]/g, "") })}
						/>
					</Inline>
					{readable ? (
						<FormFieldDescription>
							{rule.pattern ? t("editor.code.found", { n: found }) : t("editor.code.findHint")}
						</FormFieldDescription>
					) : (
						<FormFieldError>{t("editor.code.badPattern")}</FormFieldError>
					)}
				</FormField>
				<FormField>
					<FormFieldLabel>{t("editor.code.effect")}</FormFieldLabel>
					<Select
						items={CODE_TEXT_EFFECTS.map((name) => ({ value: name, label: effectLabel(name) }))}
						value={rule.name}
						onValueChange={(name) =>
							name &&
							put({
								...rule,
								name,
								attrs:
									name === "codeTip" ? { text: rule.attrs?.text ?? "" } : name === "codeFold" ? rule.attrs : undefined,
							})
						}
					>
						<SelectTrigger size="md" width="full" aria-label={t("editor.code.effect")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{CODE_TEXT_EFFECTS.map((name) => (
								<SelectItem key={name} value={name}>
									{effectLabel(name)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				{rule.name === "codeTip" ? (
					<FormField>
						<FormFieldLabel>{t("editor.code.tipText")}</FormFieldLabel>
						<Input
							size="md"
							aria-label={t("editor.code.tipText")}
							value={rule.attrs?.text ?? ""}
							onChange={(event) => put({ ...rule, attrs: { text: event.currentTarget.value } })}
						/>
					</FormField>
				) : null}
				<FormField>
					<FormFieldLabel>{t("editor.code.where")}</FormFieldLabel>
					<Inline gap={8}>
						<Select
							items={[
								{ value: "document", label: t("editor.code.whole") },
								{ value: "line", label: t("editor.code.oneLine") },
							]}
							value={rule.scope}
							onValueChange={(scope) =>
								scope &&
								put(
									scope === "line"
										? { ...rule, scope, line: rule.line ?? 0 }
										: {
												scope,
												name: rule.name,
												pattern: rule.pattern,
												flags: rule.flags,
												...(rule.attrs ? { attrs: rule.attrs } : {}),
											},
								)
							}
						>
							<SelectTrigger size="md" aria-label={t("editor.code.where")}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="document">{t("editor.code.whole")}</SelectItem>
								<SelectItem value="line">{t("editor.code.oneLine")}</SelectItem>
							</SelectContent>
						</Select>
						{rule.scope === "line" ? (
							<Input
								size="md"
								mono
								width="number"
								type="number"
								min={1}
								max={lineCount}
								aria-label={t("editor.code.lineNumber")}
								value={(rule.line ?? 0) + 1}
								onChange={(event) => {
									const line = Math.min(lineCount, Math.max(1, Number(event.currentTarget.value) || 1)) - 1;
									put({ ...rule, line });
								}}
							/>
						) : null}
					</Inline>
				</FormField>
				<Inline>
					<Button
						variant="ghost-danger"
						size="sm"
						onClick={() => {
							onChange(rules.filter((_, at) => at !== open.at));
							setOpen(null);
						}}
					>
						<TrashCan aria-hidden />
						{t("editor.code.deleteRule")}
					</Button>
				</Inline>
			</Stack>
		</PopoverContent>
	);
}
