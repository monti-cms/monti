import { type LayoutGroup, type SchemaCollection, schemaOf } from "@monti-cms/core/client";
import { t } from "./translate";

/** 기본 탭(`tab`이 없는 묶음과 필드). */
export const DEFAULT_TAB = t("tab.default");

export const tabOfGroup = (group: LayoutGroup) => group.tab ?? DEFAULT_TAB;

/**
 * 속성 칸에 그릴 묶음. 배치(`layout`) 묶음을 순서대로 두고, 배치에 없는 필드는 마지막 묶음 뒤에 선언 순서대로 둔다.
 *
 * 탭은 배치 묶음의 `tab`이 먼저고, 그 묶음에 `tab`이 없으면 필드의 `tab`이다. 제 `tab`을 가진 필드(예: 확장이 주는 필드 묶음)는
 * 탭마다 한 묶음으로 모아 맨 뒤에 둔다. 이 묶음의 이름은 탭 이름이다(탭이 없는 화면에서는 묶음 제목으로 보인다).
 */
export function layoutGroupsOf(collection: SchemaCollection): LayoutGroup[] {
	const schema = schemaOf(collection);
	const groups: LayoutGroup[] = [];
	const byTab = new Map<string, string[]>();
	const moveToTab = (name: string, tab: string) => byTab.set(tab, [...(byTab.get(tab) ?? []), name]);
	const ownTab = (name: string) => schema.fields[name]?.tab;

	for (const group of schema.layout ?? []) {
		if (group.tab !== undefined) {
			groups.push(group);
			continue;
		}
		const stay = group.fields.filter((name) => ownTab(name) === undefined);
		for (const name of group.fields) {
			const tab = ownTab(name);
			if (tab !== undefined) moveToTab(name, tab);
		}
		if (stay.length > 0) groups.push(stay.length === group.fields.length ? group : { ...group, fields: stay });
	}

	const placed = new Set((schema.layout ?? []).flatMap((group) => group.fields));
	const rest = Object.keys(schema.fields).filter((name) => !placed.has(name));
	const restStay = rest.filter((name) => ownTab(name) === undefined);
	if (restStay.length > 0) groups.push({ fields: restStay });
	for (const name of rest) {
		const tab = ownTab(name);
		if (tab !== undefined) moveToTab(name, tab);
	}
	for (const [tab, fields] of byTab) groups.push({ group: tab, tab, fields });
	return groups;
}

/** 탭 이름(기본 탭 먼저, 나머지는 묶음에 처음 나온 순서). */
export function tabsOf(collection: SchemaCollection): string[] {
	return [...new Set([DEFAULT_TAB, ...layoutGroupsOf(collection).map(tabOfGroup)])];
}

/** 필드가 들어 있는 탭. 조건부 필드에 딸린 필드는 그 필드의 탭이다. 발행 문제로 이동할 때 그 탭을 먼저 연다. */
export function tabOf(collection: SchemaCollection, path: string): string {
	const schema = schemaOf(collection);
	const top =
		Object.hasOwn(schema.fields, path) || path === "title"
			? path
			: Object.entries(schema.fields).find(
					([, field]) =>
						field.kind === "conditional" && Object.values(field.values).some((group) => group && path in group),
				)?.[0];
	const group = top === undefined ? undefined : layoutGroupsOf(collection).find((item) => item.fields.includes(top));
	return group ? tabOfGroup(group) : DEFAULT_TAB;
}
