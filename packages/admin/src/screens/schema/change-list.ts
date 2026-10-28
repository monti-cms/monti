/**
 * The changes of a schema draft as a list: one item per field, per collection setting, per language and per site or admin setting. The screen counts the items
 * ("바뀐 곳 N"), lists them in the title row's menu and puts one back at a time. The functions here are pure: they read the saved file, the draft and the
 * writer's renames, and each item carries the function that puts its part of the draft back.
 */

import {
	collectionsOf,
	fieldsOf,
	isObj,
	localesOf,
	type Obj,
	type Rename,
	removeField,
	renameField,
	reorderCollections,
	sameJson,
	sectionOf,
	setCollection,
	setProp,
	setSetting,
} from "./schema-model";

/** What a revert works on: the draft, the renames the writer made, and the collections taken out of the list. */
export interface DraftState {
	readonly draft: Obj;
	readonly renames: readonly Rename[];
	readonly removed: readonly string[];
}

/** How a part changed: it is new, gone, renamed or edited. */
export type ChangeTag = "added" | "removed" | "renamed" | "edited";

/** What changed, as the screen names it. */
export type ChangeSubject =
	| { readonly kind: "collection"; readonly name: string; readonly label: string }
	| { readonly kind: "field"; readonly name: string; readonly label: string; readonly from?: string }
	| { readonly kind: "collectionSetting"; readonly key: string }
	| { readonly kind: "body" }
	| { readonly kind: "layout" }
	| { readonly kind: "fieldOrder" }
	| { readonly kind: "collectionOrder" }
	| { readonly kind: "locale"; readonly code: string; readonly label: string }
	| { readonly kind: "defaultLocale" }
	| { readonly kind: "localeOrder" }
	| { readonly kind: "timeZone" }
	| { readonly kind: "setting"; readonly path: string };

export interface ChangeItem {
	/** Stable while the draft keeps this change (a key for lists). */
	readonly id: string;
	/** The Settings tab the change belongs to. */
	readonly area: "collections" | "locales" | "site" | "admin";
	/** The collection it is in, for the changes of a collection. */
	readonly collection?: string;
	readonly subject: ChangeSubject;
	readonly tag: ChangeTag;
	/** Puts this part of the draft back as the saved file has it. */
	readonly revert: (state: DraftState) => DraftState;
}

const labelOf = (collection: Obj | undefined, fallback: string): string =>
	typeof collection?.label === "string" && collection.label !== "" ? collection.label : fallback;

const inDraft = (state: DraftState, change: (draft: Obj) => Obj): DraftState => ({
	...state,
	draft: change(state.draft),
});

/** Collection keys that have an item of their own besides the fields: everything but `fields`, `layout` and `body`. */
const OWN_KEYS = new Set(["fields", "layout", "body"]);

/** A layout with the names mapped (or dropped when `rename` gives `null`), to compare two layouts that differ only by the fields that were added, removed or renamed. */
function layoutNames(layout: unknown, rename: (name: string) => string | null): unknown {
	if (!Array.isArray(layout)) return undefined;
	return layout.map((group) =>
		isObj(group)
			? {
					...group,
					fields: (Array.isArray(group.fields) ? (group.fields as string[]) : []).flatMap((name) => {
						const mapped = rename(name);
						return mapped === null ? [] : [mapped];
					}),
				}
			: group,
	);
}

/** Puts the field `name` back at the place it had among the fields. */
function reinsert(fields: Record<string, Obj>, name: string, field: Obj, index: number): Record<string, Obj> {
	const entries = Object.entries(fields);
	entries.splice(Math.min(index, entries.length), 0, [name, field]);
	return Object.fromEntries(entries);
}

/** Puts `name` back in the layout groups of `current` that held it in `saved` (same group, same place), for a field that is brought back. */
function restoreInLayout(current: Obj, saved: Obj, name: string): Obj {
	if (!Array.isArray(current.layout) || !Array.isArray(saved.layout)) return current;
	const layout = (current.layout as Obj[]).map((group, at) => {
		const was = saved.layout?.[at as never] as Obj | undefined;
		const names = Array.isArray(was?.fields) ? (was.fields as string[]) : [];
		const index = names.indexOf(name);
		if (index === -1 || !isObj(group)) return group;
		const fields = [...(Array.isArray(group.fields) ? (group.fields as string[]) : [])];
		fields.splice(Math.min(index, fields.length), 0, name);
		return { ...group, fields };
	});
	return { ...current, layout };
}

function collectionItems(name: string, saved: Obj, draft: Obj, renames: readonly Rename[]): ChangeItem[] {
	const items: ChangeItem[] = [];
	const area = "collections";
	const base = (change: Omit<ChangeItem, "area" | "collection">): ChangeItem => ({ area, collection: name, ...change });

	for (const key of new Set([...Object.keys(saved), ...Object.keys(draft)])) {
		if (OWN_KEYS.has(key) || sameJson(saved[key], draft[key])) continue;
		items.push(
			base({
				id: `collection:${name}:${key}`,
				subject: { kind: "collectionSetting", key },
				tag: "edited",
				revert: (state) =>
					inDraft(state, (file) => setCollection(file, name, (current) => setProp(current, key, saved[key]))),
			}),
		);
	}

	const savedFields = fieldsOf(saved);
	const draftFields = fieldsOf(draft);
	const fieldRenames = renames.filter(
		(item): item is Extract<Rename, { kind: "field" }> =>
			item.kind === "field" && item.collection === name && item.from in savedFields && item.to in draftFields,
	);
	const renamedFrom = new Map(fieldRenames.map((item) => [item.to, item.from]));
	const renamedTo = new Map(fieldRenames.map((item) => [item.from, item.to]));
	const savedNames = Object.keys(savedFields);

	for (const [fieldName, field] of Object.entries(draftFields)) {
		const from = renamedFrom.get(fieldName);
		const before = savedFields[from ?? fieldName];
		const fieldLabel = labelOf(field, fieldName);
		if (before === undefined) {
			items.push(
				base({
					id: `field:${name}:${fieldName}`,
					subject: { kind: "field", name: fieldName, label: fieldLabel },
					tag: "added",
					revert: (state) =>
						inDraft(state, (file) => setCollection(file, name, (current) => removeField(current, {}, fieldName))),
				}),
			);
		} else if (from !== undefined) {
			items.push(
				base({
					id: `field:${name}:${fieldName}`,
					subject: { kind: "field", name: fieldName, label: fieldLabel, from },
					tag: "renamed",
					revert: (state) => ({
						...state,
						renames: state.renames.filter(
							(item) =>
								!(
									item.collection === name && (item.kind === "field" ? item.to === fieldName : item.field === fieldName)
								),
						),
						draft: setCollection(state.draft, name, (current) => {
							const back = renameField(current, {}, fieldName, from);
							return { ...back, fields: { ...fieldsOf(back), [from]: before } };
						}),
					}),
				}),
			);
		} else if (!sameJson(before, field)) {
			items.push(
				base({
					id: `field:${name}:${fieldName}`,
					subject: { kind: "field", name: fieldName, label: fieldLabel },
					tag: "edited",
					revert: (state) => ({
						...state,
						renames: state.renames.filter(
							(item) => !(item.kind === "option" && item.collection === name && item.field === fieldName),
						),
						draft: setCollection(state.draft, name, (current) => ({
							...current,
							fields: { ...fieldsOf(current), [fieldName]: before },
						})),
					}),
				}),
			);
		}
	}
	for (const [fieldName, field] of Object.entries(savedFields)) {
		if (fieldName in draftFields || renamedTo.has(fieldName)) continue;
		items.push(
			base({
				id: `field:${name}:${fieldName}`,
				subject: { kind: "field", name: fieldName, label: labelOf(field, fieldName) },
				tag: "removed",
				revert: (state) =>
					inDraft(state, (file) =>
						setCollection(file, name, (current) =>
							restoreInLayout(
								{ ...current, fields: reinsert(fieldsOf(current), fieldName, field, savedNames.indexOf(fieldName)) },
								saved,
								fieldName,
							),
						),
					),
			}),
		);
	}

	// The order of the fields that exist on both sides.
	const common = (names: string[]) => names.filter((fieldName) => renamedTo.has(fieldName) || fieldName in draftFields);
	const savedOrder = common(savedNames).map((fieldName) => renamedTo.get(fieldName) ?? fieldName);
	const draftOrder = Object.keys(draftFields).filter(
		(fieldName) => renamedFrom.has(fieldName) || fieldName in savedFields,
	);
	if (!sameJson(savedOrder, draftOrder)) {
		items.push(
			base({
				id: `fieldOrder:${name}`,
				subject: { kind: "fieldOrder" },
				tag: "edited",
				revert: (state) =>
					inDraft(state, (file) =>
						setCollection(file, name, (current) => {
							const fields = fieldsOf(current);
							const ordered = savedOrder.flatMap((fieldName) => (fieldName in fields ? [fieldName] : []));
							const rest = Object.keys(fields).filter((fieldName) => !ordered.includes(fieldName));
							return { ...current, fields: Object.fromEntries([...ordered, ...rest].map((key) => [key, fields[key]])) };
						}),
					),
			}),
		);
	}

	// A layout that differs only by fields that were added, removed or renamed is not a change of its own.
	const savedLayout = layoutNames(saved.layout, (fieldName) =>
		fieldName in draftFields || renamedTo.has(fieldName) ? (renamedTo.get(fieldName) ?? fieldName) : null,
	);
	const draftLayout = layoutNames(draft.layout, (fieldName) =>
		fieldName in savedFields || renamedFrom.has(fieldName) ? fieldName : null,
	);
	if (!sameJson(savedLayout, draftLayout)) {
		items.push(
			base({
				id: `layout:${name}`,
				subject: { kind: "layout" },
				tag: "edited",
				revert: (state) =>
					inDraft(state, (file) => setCollection(file, name, (current) => setProp(current, "layout", saved.layout))),
			}),
		);
	}
	if (!sameJson(saved.body, draft.body)) {
		items.push(
			base({
				id: `body:${name}`,
				subject: { kind: "body" },
				tag: "edited",
				revert: (state) =>
					inDraft(state, (file) => setCollection(file, name, (current) => setProp(current, "body", saved.body))),
			}),
		);
	}
	return items;
}

/**
 * The changes between the saved file and the draft, in the order of the screen: collections (each new, taken out, or its settings and fields), languages,
 * then the `site` and `admin` settings. A collection that was never saved is one change however many fields it has, and a collection taken out of the list is
 * one change whatever was edited in it before.
 */
export function changeItems(saved: Obj, state: DraftState): ChangeItem[] {
	const { draft, renames, removed } = state;
	const items: ChangeItem[] = [];
	const before = collectionsOf(saved);
	const after = collectionsOf(draft);

	for (const [name, collection] of Object.entries(after)) {
		const label = labelOf(collection, name);
		const subject = { kind: "collection", name, label } as const;
		if (removed.includes(name)) {
			if (name in before)
				items.push({
					id: `collection:${name}`,
					area: "collections",
					collection: name,
					subject,
					tag: "removed",
					revert: (current) => ({ ...current, removed: current.removed.filter((item) => item !== name) }),
				});
			continue;
		}
		const savedCollection = before[name];
		if (savedCollection === undefined) {
			items.push({
				id: `collection:${name}`,
				area: "collections",
				collection: name,
				subject,
				tag: "added",
				revert: (current) => ({
					...current,
					renames: current.renames.filter((item) => item.collection !== name),
					draft: {
						...current.draft,
						collections: Object.fromEntries(
							Object.entries(collectionsOf(current.draft)).filter(([key]) => key !== name),
						),
					},
				}),
			});
			continue;
		}
		items.push(...collectionItems(name, savedCollection, collection, renames));
	}

	// The order of the collections that exist on both sides.
	const live = (names: string[]) => names.filter((name) => name in before && name in after && !removed.includes(name));
	const savedOrder = live(Object.keys(before));
	if (!sameJson(savedOrder, live(Object.keys(after)))) {
		items.push({
			id: "collections:order",
			area: "collections",
			subject: { kind: "collectionOrder" },
			tag: "edited",
			revert: (current) => inDraft(current, (file) => reorderCollections(file, savedOrder)),
		});
	}

	// Languages: each one that came or went, each one whose names changed, the source language and the time zone.
	const savedLocales = localesOf(saved);
	const draftLocales = localesOf(draft);
	for (const locale of draftLocales) {
		const was = savedLocales.find((item) => item.code === locale.code);
		const subject = { kind: "locale", code: locale.code, label: locale.label ?? locale.name } as const;
		if (!was) {
			items.push({
				id: `locale:${locale.code}`,
				area: "locales",
				subject,
				tag: "added",
				revert: (current) =>
					inDraft(current, (file) => ({
						...file,
						locales: localesOf(file).filter((item) => item.code !== locale.code),
					})),
			});
		} else if (!sameJson(was, locale)) {
			items.push({
				id: `locale:${locale.code}`,
				area: "locales",
				subject,
				tag: "edited",
				revert: (current) =>
					inDraft(current, (file) => ({
						...file,
						locales: localesOf(file).map((item) => (item.code === locale.code ? was : item)),
					})),
			});
		}
	}
	for (const locale of savedLocales) {
		if (draftLocales.some((item) => item.code === locale.code)) continue;
		const index = savedLocales.indexOf(locale);
		items.push({
			id: `locale:${locale.code}`,
			area: "locales",
			subject: { kind: "locale", code: locale.code, label: locale.label ?? locale.name },
			tag: "removed",
			revert: (current) =>
				inDraft(current, (file) => {
					const list = [...localesOf(file)];
					list.splice(Math.min(index, list.length), 0, locale);
					return { ...file, locales: list };
				}),
		});
	}
	// The source language, or the order of the languages that exist on both sides.
	const codesOf = (file: Obj) => localesOf(file).map((item) => item.code);
	const sharedCodes = codesOf(draft).filter((code) => codesOf(saved).includes(code));
	const savedShared = codesOf(saved).filter((code) => codesOf(draft).includes(code));
	const defaultChanged = !sameJson(saved.defaultLocale, draft.defaultLocale);
	if (defaultChanged || !sameJson(sharedCodes, savedShared)) {
		items.push({
			id: defaultChanged ? "locales:default" : "locales:order",
			area: "locales",
			subject: { kind: defaultChanged ? "defaultLocale" : "localeOrder" },
			tag: "edited",
			revert: (current) =>
				inDraft(current, (file) => {
					const list = localesOf(file);
					const first = codesOf(saved).flatMap((code) => list.filter((item) => item.code === code));
					const rest = list.filter((item) => !codesOf(saved).includes(item.code));
					return { ...setProp(file, "defaultLocale", saved.defaultLocale), locales: [...first, ...rest] };
				}),
		});
	}
	if (!sameJson(saved.timeZone, draft.timeZone)) {
		items.push({
			id: "locales:timeZone",
			area: "locales",
			subject: { kind: "timeZone" },
			tag: "edited",
			revert: (current) => inDraft(current, (file) => setProp(file, "timeZone", saved.timeZone)),
		});
	}

	for (const section of ["site", "admin"] as const) {
		const was = sectionOf(saved, section);
		const now = sectionOf(draft, section);
		for (const key of new Set([...Object.keys(now), ...Object.keys(was)])) {
			if (sameJson(was[key], now[key])) continue;
			items.push({
				id: `${section}:${key}`,
				area: section,
				subject: { kind: "setting", path: `${section}.${key}` },
				tag: was[key] === undefined ? "added" : now[key] === undefined ? "removed" : "edited",
				revert: (current) => inDraft(current, (file) => setSetting(file, section, key, was[key])),
			});
		}
	}
	return items;
}

/** The state with every item put back (the saved file, no renames, nothing taken out). */
export const savedState = (saved: Obj): DraftState => ({ draft: saved, renames: [], removed: [] });
