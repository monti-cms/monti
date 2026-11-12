import { KEY_NAME_MAX, type KeyList, type KeyRow } from "@monti-cms/core";
import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogFormFooter,
	DialogHeader,
	DialogTitle,
	FormField,
	FormFieldDescription,
	FormFieldError,
	FormFieldLabel,
	Input,
	PickList,
	PickListItem,
	SavedValue,
	SecretInput,
	Stack,
	Text,
	toast,
} from "@monti-cms/ui";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { reasonOf, useOperation } from "../../operations/use-operation";
import { PickOne } from "../settings/pick-one";

type Service = KeyList["services"][number];

/** What the key window is open for: to pick the service of a new key, to add a key of a service, or to change a key. */
export type KeyWindowState = { mode: "pick" } | { mode: "add"; service: string } | { mode: "edit"; key: KeyRow };
type KeyFormState = Exclude<KeyWindowState, { mode: "pick" }>;

type Field = "address" | "name" | "secret";

/** A service as the screen names it: the OpenAI-compatible one in the admin's language, the others by their own names. */
function useServiceName() {
	const { t } = useAdmin();
	return (service: Pick<Service, "id" | "name">) =>
		service.id === "openai-compatible" ? t("apiKeys.service.compatible") : service.name;
}

/** The host of an address ("localhost:11434"), or nothing while it is not one yet. */
function hostOf(address: string): string | null {
	try {
		return new URL(address).host || null;
	} catch {
		return null;
	}
}

/** The first name not taken: the name itself, or the name with the next number after it ("Anthropic 2"). */
function freeName(base: string, taken: string[]): string {
	if (!taken.includes(base)) return base;
	for (let number = 2; ; number += 1) if (!taken.includes(`${base} ${number}`)) return `${base} ${number}`;
}

/**
 * The key window (tools.md), one window from the add button to the stored key: it asks which service first, and picking one turns the same window
 * into the key's fields, so nothing closes and opens between the two. `nth` counts its openings: each starts with empty fields. When it has
 * closed and its fade is over, `onClosed` lets the screen take it out of the page, with whatever was typed. Both name the opening they are
 * about (`nth`): an answer that comes for a window closed earlier never closes the one opened since.
 */
export function KeyWindow({
	state,
	open,
	nth,
	services,
	names,
	onPick,
	onClose,
	onClosed,
	onStale,
}: {
	state: KeyWindowState;
	open: boolean;
	nth: number;
	services: Service[];
	/** The names the keys have: a new key's name starts as one not taken. */
	names: string[];
	onPick: (service: string) => void;
	onClose: (nth: number) => void;
	onClosed: (nth: number) => void;
	/** The key changed elsewhere since the list was read: the list is read again. */
	onStale: () => void;
}) {
	const { t } = useAdmin();
	const nameOf = useServiceName();
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => !next && onClose(nth)}
			onOpenChangeComplete={(next) => !next && onClosed(nth)}
		>
			<DialogContent form={state.mode !== "pick"}>
				{state.mode === "pick" ? (
					<>
						<DialogHeader>
							<DialogTitle>{t("apiKeys.add")}</DialogTitle>
						</DialogHeader>
						<PickList aria-label={t("apiKeys.service")}>
							{services.map((service) => (
								<PickListItem key={service.id} onClick={() => onPick(service.id)}>
									{nameOf(service)}
								</PickListItem>
							))}
						</PickList>
						<DialogFooter>
							<Button variant="ghost" onClick={() => onClose(nth)}>
								{t("ui.cancel")}
							</Button>
						</DialogFooter>
					</>
				) : (
					<KeyForm
						key={nth}
						state={state}
						open={open}
						services={services}
						names={names}
						onClose={() => onClose(nth)}
						onStale={onStale}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

/**
 * The key's fields: adds a key, or changes one's name, address or the key itself. The service is asked whether it takes the key before anything is
 * stored; what it says comes back under the field it is about, and the window stays open with what was typed. The key is in the page only here,
 * while it is typed.
 */
function KeyForm({
	state,
	open,
	services,
	names,
	onClose,
	onStale,
}: {
	state: KeyFormState;
	/** Whether its window is open: once it is not (the screen was left meanwhile), an answer still on its way is told in a toast. */
	open: boolean;
	services: Service[];
	names: string[];
	onClose: () => void;
	onStale: () => void;
}) {
	const { t } = useAdmin();
	const nameOf = useServiceName();
	const add = useOperation("keys.add");
	const update = useOperation("keys.update");
	const editing = state.mode === "edit" ? state.key : null;
	const ids = { service: useId(), address: useId(), name: useId(), secret: useId() };
	const inputs = {
		address: useRef<HTMLInputElement>(null),
		name: useRef<HTMLInputElement>(null),
		secret: useRef<HTMLInputElement>(null),
	};

	const [serviceId, setServiceId] = useState(state.mode === "edit" ? state.key.service : state.service);
	/** Until the service is changed in the window: the caret goes to the first empty field only as the window opens, never away from the service just picked. */
	const [asOpened, setAsOpened] = useState(true);
	const service = services.find((each) => each.id === serviceId);
	const serviceName = service ? nameOf(service) : (editing?.serviceName ?? serviceId);
	const others = editing ? names.filter((name) => name !== editing.name) : names;
	/** What a new key is called until the person says otherwise: its service, or the host of its address, with a number when that is taken. */
	const suggested = (ofService: Service | undefined, ofAddress: string) => {
		const base = (ofService?.address ? hostOf(ofAddress) : null) ?? (ofService ? nameOf(ofService) : "");
		return { base, name: freeName(base, others) };
	};
	const [address, setAddress] = useState(editing?.baseUrl ?? "");
	const [name, setName] = useState(editing ? editing.name : suggested(service, "").name);
	const [named, setNamed] = useState(false);
	const [secret, setSecret] = useState("");
	/** Editing a key the server reads: the stored key shows until "Replace" opens the field. One it cannot read is entered again from the start. */
	const [replacing, setReplacing] = useState(editing ? !editing.readable : true);
	const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
	const [checking, setChecking] = useState(false);
	// The window as it is when an answer comes, not as it was when the question went: closed by "Cancel", by Esc, by a press outside, or gone
	// from the page since. There is then no field left to say anything under, and nothing of this form's to close.
	const shown = useRef(open);
	shown.current = open;
	useEffect(
		() => () => {
			shown.current = false;
		},
		[],
	);
	const pending = add.pending || update.pending;

	const hint = suggested(service, address);
	const fix = (field: Field, message: string) => {
		setErrors({ [field]: message });
		inputs[field].current?.focus();
	};
	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (pending) return;
		setErrors({});
		const baseUrl = address.trim();
		// A field that must be filled says so itself, and the service is not asked.
		if (service?.address && baseUrl === "") return fix("address", t("settings.fillIn"));
		if (name.trim() === "") return fix("name", t("settings.fillIn"));
		const needsKey = replacing && !service?.keyOptional;
		if (needsKey && secret.trim() === "") return fix("secret", t("settings.fillIn"));

		let result: Awaited<ReturnType<typeof add.run>>;
		if (editing) {
			const changed = {
				...(name.trim() !== editing.name ? { name: name.trim() } : {}),
				...(replacing ? { secret } : {}),
				...(service?.address && baseUrl !== (editing.baseUrl ?? "") ? { baseUrl } : {}),
			};
			if (Object.keys(changed).length === 0) return onClose();
			// The service is asked again only for a new key or a new address.
			setChecking("secret" in changed || "baseUrl" in changed);
			result = await update.run(
				{ id: editing.id, ...changed },
				{ versions: { [`key:${editing.id}`]: editing.version } },
			);
		} else {
			setChecking(true);
			result = await add.run({
				service: serviceId,
				name: name.trim(),
				secret,
				...(service?.address ? { baseUrl } : {}),
			});
		}
		if (result.ok) {
			toast(t(editing ? "apiKeys.saved" : "apiKeys.added"));
			if (shown.current) onClose();
			return;
		}
		const { refusal } = result;
		if (refusal.error === "conflict") {
			toast.error(t("ui.savedElsewhere"));
			onStale();
			if (shown.current) onClose();
			return;
		}
		// Closed while the service was being asked: there is no field left to say it under.
		if (!shown.current) return void toast.error(t(reasonOf(refusal)));
		const words = t(reasonOf(refusal));
		switch (refusal.reason?.key) {
			case "keys.refused":
			case "keys.needsKey":
				return fix("secret", words);
			case "keys.unreachable":
				return fix(service?.address ? "address" : "secret", words);
			case "keys.nameTaken":
				return fix("name", words);
			case "keys.badAddress":
				return fix("address", words);
			default:
				// Not about any one field (the server failed): said in a toast, and the caret is back in the form as after a refusal, in the key
				// when its field is open.
				toast.error(words);
				(inputs.secret.current ?? inputs.name.current)?.focus();
		}
	};

	const secretField = (
		<SecretInput
			ref={inputs.secret}
			id={ids.secret}
			value={secret}
			onChange={(event) => setSecret(event.target.value)}
			showLabel={t("apiKeys.show")}
			hideLabel={t("apiKeys.hide")}
			placeholder={
				service?.keyOptional ? t("apiKeys.noneValue") : editing ? undefined : (service?.placeholder ?? undefined)
			}
			aria-invalid={errors.secret !== undefined || undefined}
			// The first empty field takes the caret: the key, unless an address comes before it.
			autoFocus={editing ? true : !service?.address}
			{...(editing?.readable
				? {
						keep: {
							label: t("apiKeys.keep"),
							onClick: () => {
								setReplacing(false);
								setSecret("");
								setErrors({});
							},
						},
					}
				: {})}
		/>
	);

	return (
		<Stack as="form" gap={16} onSubmit={(event) => void submit(event as FormEvent)}>
			<DialogHeader>
				<DialogTitle of={editing ? editing.name : undefined}>{t(editing ? "apiKeys.edit" : "apiKeys.add")}</DialogTitle>
			</DialogHeader>
			<FormField>
				<FormFieldLabel htmlFor={editing ? undefined : ids.service}>{t("apiKeys.service")}</FormFieldLabel>
				{editing ? (
					<Text>{serviceName}</Text>
				) : (
					<PickOne
						id={ids.service}
						items={services.map((each) => ({ value: each.id, label: nameOf(each) }))}
						value={serviceId}
						onChange={(next) => {
							setServiceId(next);
							setAsOpened(false);
							setErrors({});
							if (!named)
								setName(
									suggested(
										services.find((each) => each.id === next),
										address,
									).name,
								);
						}}
					/>
				)}
			</FormField>
			{service?.address ? (
				<FormField>
					<FormFieldLabel htmlFor={ids.address} required={service.keyOptional}>
						{t("apiKeys.address")}
					</FormFieldLabel>
					<Input
						ref={inputs.address}
						id={ids.address}
						mono
						value={address}
						onChange={(event) => {
							setAddress(event.target.value);
							if (!editing && !named) setName(suggested(service, event.target.value).name);
						}}
						aria-invalid={errors.address !== undefined || undefined}
						autoFocus={!editing && asOpened}
					/>
					{errors.address ? <FormFieldError>{errors.address}</FormFieldError> : null}
				</FormField>
			) : null}
			<FormField>
				<FormFieldLabel htmlFor={ids.name} required={service?.keyOptional}>
					{t("apiKeys.name")}
				</FormFieldLabel>
				<Input
					ref={inputs.name}
					id={ids.name}
					maxLength={KEY_NAME_MAX}
					value={name}
					onChange={(event) => {
						setName(event.target.value);
						setNamed(true);
					}}
					aria-invalid={errors.name !== undefined || undefined}
					autoFocus={editing?.readable}
				/>
				{errors.name ? (
					<FormFieldError>{errors.name}</FormFieldError>
				) : !editing && !named && name !== hint.base ? (
					// The name was taken, so the window put a number after it: it says which name that was.
					<FormFieldDescription>{t("apiKeys.nameTaken", { name: hint.base })}</FormFieldDescription>
				) : null}
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor={replacing ? ids.secret : undefined}>{t("apiKeys.key")}</FormFieldLabel>
				{editing && !replacing ? (
					<SavedValue action={{ label: t("apiKeys.replace"), onClick: () => setReplacing(true) }}>
						{editing.last4 ? `··· ${editing.last4}` : editing.hasKey ? "···" : t("apiKeys.noneValue")}
					</SavedValue>
				) : (
					secretField
				)}
				{errors.secret ? (
					<FormFieldError>{errors.secret}</FormFieldError>
				) : editing && !editing.readable ? (
					<FormFieldDescription>{t("apiKeys.enterAgain")}</FormFieldDescription>
				) : null}
			</FormField>
			{/* While the service is asked the window cannot be left: not by Cancel, not by Escape, not by a press outside. Leaving would mean
			    "do not add it", and the server cannot call the add back once it is sent. The wait is the check's, ten seconds at most. The
			    footer keeps that lock, for the whole window. */}
			<DialogFormFooter
				onCancel={onClose}
				submitLabel={t(editing ? "ui.save" : "apiKeys.addSubmit")}
				busy={pending}
				lockWhileBusy
				busyLabel={checking ? t("apiKeys.checking") : undefined}
			/>
		</Stack>
	);
}
