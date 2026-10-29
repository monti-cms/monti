import type { Meta } from "@storybook/react-vite";
import {
	answer,
	body,
	changesButton,
	expect,
	fireEvent,
	openReview,
	type Play,
	previewOf,
	readOnlyState,
	server,
	setValue,
	story,
	tLocales,
	tReview,
	tSite,
	userEvent,
	waitFor,
	within,
} from "../../test/schema-story-api";

/**
 * The Settings page, one story per stage of the Settings and Languages boards of the canvas (flow 11): the site tab, the languages tab and the admin tab,
 * the page while it loads and when it cannot, and the lock variants. Every story is shot by the visual checks.
 */
const meta = {
	title: "Screens/Settings",
	parameters: { layout: "fullscreen", bleed: true },
	tags: ["visual"],
} satisfies Meta;
export default meta;

// ----- the site tab (board Settings) -----

/** The two changes the board's first stages carry: the site name and the preview path. */
const editSite: Play = async ({ canvasElement }) => {
	const canvas = within(canvasElement);
	setValue(await canvas.findByRole("textbox", { name: tSite("site.name") }), "example.dev");
	setValue(await canvas.findByRole("textbox", { name: tSite("site.previewPath") }), "draft");
	await changesButton(canvasElement);
};

/** Stage 기본: the site tab with two changes. */
export const Site = story(server(), "site", undefined, { play: editSite });

/** Stage 호스트 추가: "+ 호스트" adds an empty row with the caret in it. */
export const SiteHostAdded = story(server(), "site", undefined, {
	play: async (context) => {
		await editSite(context);
		await userEvent.click(await within(context.canvasElement).findByRole("button", { name: tSite("site.alias.add") }));
	},
});

/** Stage 언어 쿼리: "language in the preview path" turned off shows the query field, empty. */
export const SiteLocaleQuery = story(server(), "site", undefined, {
	play: async (context) => {
		await editSite(context);
		const canvas = within(context.canvasElement);
		await userEvent.click(await canvas.findByRole("switch", { name: tSite("site.previewInPath") }));
		// The board's query field has the caret in it.
		(await canvas.findByRole("textbox", { name: tSite("site.previewParam") })).focus();
	},
});

/** Stage 칸 오류: a host name that is not a host name shows the one error line under its row and turns the save off. */
export const SiteFieldError = story(server(), "site", undefined, {
	play: async (context) => {
		await editSite(context);
		const canvas = within(context.canvasElement);
		setValue(await canvas.findByRole("textbox", { name: tSite("site.alias.row", { number: 1 }) }), "example dev");
	},
});

/** Stage 나가기 확인: a link followed with unsaved changes asks first. */
export const SiteLeaveConfirm = story(server(), "site", undefined, {
	play: async (context) => {
		await editSite(context);
		// A sidebar link, which the guard holds back: the page stays where it is.
		const link = (await within(context.canvasElement).findAllByRole("link")).find(
			(item) => item.getAttribute("href") !== null,
		);
		if (!link) throw new Error("the sidebar has no link");
		fireEvent.click(link);
		await body().findByRole("alertdialog");
	},
});

/** Stage 읽기 전용: the lock beside the titles of the sections that cannot be changed, no save group. */
export const SiteReadOnly = story(server({ state: readOnlyState() }), "site");

// ----- the languages tab (board Locales) -----

const languages = (canvasElement: HTMLElement) => within(canvasElement);
const openFinder = async (canvasElement: HTMLElement) => {
	await userEvent.click(await languages(canvasElement).findByRole("button", { name: tLocales("locales.add") }));
	return body().findByRole("combobox", { name: tLocales("locales.search") });
};

/** Stage 기본: the source language on top with 원문 and 바꾸기, the others with a handle and a ×. */
export const Locales = story(server(), "locales");

/** Stage 언어 찾기: "+ 언어 추가" opens the finder; "zh" lists the variants, the last row is 직접 입력. */
export const LocalesFind = story(server(), "locales", undefined, {
	play: async ({ canvasElement }) => {
		setValue(await openFinder(canvasElement), "zh");
		await body().findByRole("option", { name: new RegExp(tLocales("locales.custom")) });
	},
});

/** Stage 직접 입력: a code the list does not know asks for the two names in a small window. */
export const LocalesCustom = story(server(), "locales", undefined, {
	play: async ({ canvasElement }) => {
		setValue(await openFinder(canvasElement), "tlh");
		await userEvent.click(await body().findByRole("option", { name: new RegExp(tLocales("locales.custom")) }));
		await body().findByRole("dialog");
	},
});

/** Stage 언어 추가됨: a language picked from the finder is a row at once, marked new, with one change. */
export const LocalesAdded = story(server(), "locales", undefined, {
	play: async ({ canvasElement }) => {
		setValue(await openFinder(canvasElement), "ja");
		const list = await body().findByRole("listbox", { name: tLocales("locales.codes") });
		await userEvent.click(within(list).getAllByRole("option")[0] as HTMLElement);
		await languages(canvasElement).findByTestId("locale-ja");
	},
});

const openSourceMenu = async (canvasElement: HTMLElement) => {
	const row = await languages(canvasElement).findByTestId("locale-ko");
	await userEvent.click(within(row).getByRole("button", { name: tLocales("locales.sourceChange") }));
	await body().findByRole("menu");
};

/** Stage 원문 메뉴: 바꾸기 opens the list of languages with a tick on the source. */
export const LocalesSourceMenu = story(server(), "locales", undefined, {
	play: async ({ canvasElement }) => openSourceMenu(canvasElement),
});

/** Stage 원문 바꿈: another language chosen as the source moves to the top, and both rows are marked. */
export const LocalesSourceChanged = story(server(), "locales", undefined, {
	play: async ({ canvasElement }) => {
		await openSourceMenu(canvasElement);
		await userEvent.click(await body().findByRole("menuitemradio", { name: "English" }));
		await waitFor(() => expect(languages(canvasElement).getByTestId("locale-en")).toBeTruthy());
	},
});

const english = { code: "en", name: "English" };
/** The server says English has twelve translations, and that taking it out can leave them or move them to the trash. */
const removeEnglish = previewOf({
	impacts: [
		{
			change: { kind: "locale_removed", locale: "en" },
			key: "locale_removed:en",
			entries: 12,
			sample: [],
			consequence: "trashed",
			checked: true,
		},
	],
	decisions: [
		{
			key: "locale_removed:en",
			change: { kind: "locale_removed", locale: english.code },
			entries: 12,
			sample: [],
			suggestions: [{ op: "trashLocale", locale: english.code }],
			chosen: null,
		},
	],
});

/** Stage 빼기 검토: a language with translations taken out; the review sheet asks what happens to them. */
export const LocalesRemoveReview = story(server({ preview: removeEnglish }), "locales", undefined, {
	play: async ({ canvasElement }) => {
		const row = await languages(canvasElement).findByTestId("locale-en");
		await userEvent.click(within(row).getByRole("button", { name: tLocales("locales.remove", { name: "English" }) }));
		const sheet = await openReview(canvasElement);
		await within(sheet).findByTestId("impact-locale_removed:en");
		expect(within(sheet).getByText(tReview("note.locale"))).toBeTruthy();
	},
});

/** Stage 읽기 전용: no handles, no ×, no 바꾸기, no "+ 언어 추가"; a lock beside the title. */
export const LocalesReadOnly = story(server({ state: readOnlyState() }), "locales");

// ----- the admin tab -----

export const Admin = story(server(), "admin");

// ----- while it loads and when it cannot -----

export const Loading = story(() => "pending", "collections");
export const LoadFailed = story(() => answer(500), "collections");
