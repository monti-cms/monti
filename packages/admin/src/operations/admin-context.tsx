import { assistantMessages } from "@monti-cms/ai/messages";
import {
	type AnyBlockDefinition,
	type Block,
	coreMessages,
	formatMessage,
	type Message,
	type MessageBundle,
} from "@monti-cms/core";
import { type ComponentType, createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { adminMessages } from "../messages";
import type { AdminPlugin, DocumentView, FieldInput, FieldViewProps } from "../plugins";
import { httpStreams, httpUploader, type StreamTransport, type Transport, type Uploader } from "./transport";

export type Language = "ko" | "en";
export type AdminBlockComponent = ComponentType<{
	block: Block;
	attrs: Record<string, unknown>;
	children?: ReactNode;
}>;
export type AdminBlockDefinition = Omit<AnyBlockDefinition, "Site" | "Editor"> & {
	Site?: AdminBlockComponent;
	Editor?: AdminBlockComponent;
};

type ScreenHandler = (input: unknown) => void;

/**
 * Where screen operations (`list.show`, `list.select`) reach the screen: the assistant runs one, and the screen that is open handles it. They change no
 * data, so the server never runs them (doc 00, operation kinds).
 */
export type ScreenChannel = {
	run: (name: string, input: unknown) => boolean;
	on: (name: string, handler: ScreenHandler) => () => void;
};

export function createScreenChannel(): ScreenChannel {
	const handlers = new Map<string, ScreenHandler>();
	return {
		run: (name, input) => {
			const handler = handlers.get(name);
			handler?.(input);
			return handler !== undefined;
		},
		on: (name, handler) => {
			handlers.set(name, handler);
			return () => {
				if (handlers.get(name) === handler) handlers.delete(name);
			};
		},
	};
}

type AdminContext = {
	transport: Transport;
	streams: StreamTransport;
	uploader: Uploader;
	language: Language;
	/** The site's name over the sidebar and the login form. */
	siteName: string;
	/** The name the site's code gives, shown while the settings hold none: the name field's placeholder. */
	siteNameDefault: string;
	/** Body templates are offered (settings › admin): off, the "/" menu and the tools leave them out (doc 03). */
	templates: boolean;
	/** What the settings hold of the three above, once `auth.state` has said it: a saved name and language take the place of the site code's. */
	setFace: (face: Face) => void;
	/** Where the admin API is mounted (`/admin/api`): the GitHub sign-in is a page the browser goes to there. */
	apiBase: string;
	/** Tells the screens a write went through, so what they show from other reads (the sidebar's counts) is read again. */
	wrote: () => void;
	onWrite: (listener: () => void) => () => void;
	screen: ScreenChannel;
	/** Runtime block components from the same definitions the site gives core. */
	blocks: ReadonlyMap<string, AdminBlockDefinition>;
	/** What the plugins' browser halves bring: inputs and views by name, tool page screens by `<plugin>/<page>` (doc 14). */
	inputs: ReadonlyMap<string, FieldInput>;
	views: ReadonlyMap<string, ComponentType<FieldViewProps>>;
	toolPages: ReadonlyMap<string, ComponentType>;
	/** The plugins' views of the document, in the plugins' order; `key` is `<plugin>/<view>`. */
	documentViews: readonly (DocumentView & { key: string })[];
	/** The admin's words in its language: a key of the admin's or the core's dictionary, with its values. */
	t: (message: Message | string, values?: Message["values"]) => string;
	/**
	 * The session ended while the admin was open (a call came back without one, doc 15): every screen shows the banner at its top until the person
	 * signs in again (`resume`).
	 */
	session: { ended: boolean; end: () => void; resume: () => void };
};

/** What `auth.state` gives the admin to draw with (doc 12): the saved name and language, `null` where nothing is saved yet. */
export type Face = { name: string | null; language: Language | null; templates: boolean };

const Context = createContext<AdminContext | null>(null);

// The assistant's own words (why a run stopped, a conversation's activity row) come from its package: the server answers with their keys.
const BUNDLES: MessageBundle[] = [adminMessages, coreMessages, assistantMessages];
/** For what the server says: the core's words first. */
const SERVER_BUNDLES: MessageBundle[] = [coreMessages, assistantMessages, adminMessages];

/**
 * A message in the admin's language. A key is the screen's own word and is read from the admin's dictionary first; a message object came from an
 * operation (a refusal's reason, a line of the activity log) and is read from the core's first. The two dictionaries name things alike
 * (`templates.save` is the editor's "Save" button here and "Saved template {name}" in the log), so which one speaks is decided by who said it.
 */
export function wordsOf(language: Language, message: Message | string, values?: Message["values"]): string {
	return typeof message === "string"
		? formatMessage(BUNDLES, language, { key: message, values })
		: formatMessage(SERVER_BUNDLES, language, message);
}

/** One list for "none": a new one on each render would make every screen read again whenever this one changes, as when the session ends. */
const NO_BLOCKS: AdminBlockDefinition[] = [];
const NO_PLUGINS: AdminPlugin[] = [];

export function AdminProvider({
	transport,
	streams,
	uploader,
	language = "ko",
	siteName,
	apiBase = "/admin/api",
	screen,
	blocks = NO_BLOCKS,
	plugins = NO_PLUGINS,
	children,
}: {
	transport: Transport;
	/** How streams are listened to; over HTTP at `apiBase` when left out. */
	streams?: StreamTransport;
	/** How file bytes go up; over HTTP at `apiBase` when left out. Storybook hands in one of its own. */
	uploader?: Uploader;
	/** The admin's language until one is picked in settings › admin. */
	language?: Language;
	/** The site's name until one is saved in settings › site. */
	siteName: string;
	apiBase?: string;
	/** The assistant's way to the screen; one of its own by default. */
	screen?: ScreenChannel;
	blocks?: AdminBlockDefinition[];
	/** The plugins' browser halves (`defineAdminPlugin`). */
	plugins?: AdminPlugin[];
	children: ReactNode;
}) {
	const [face, setFace] = useState<Face>({ name: null, language: null, templates: true });
	const shownLanguage = face.language ?? language;
	const shownName = face.name ?? siteName;
	const [ended, setEnded] = useState(false);
	// The ways to change it never change, so a call that ends the session does not make every screen's reads anew.
	const end = useCallback(() => setEnded(true), []);
	const resume = useCallback(() => setEnded(false), []);
	const session = useMemo(() => ({ ended, end, resume }), [ended, end, resume]);
	// Made once: a change of language must not make the write notices anew, or every screen would read again.
	const writes = useMemo(() => {
		const listeners = new Set<() => void>();
		return {
			wrote: () => {
				for (const listener of listeners) listener();
			},
			onWrite: (listener: () => void) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
		};
	}, []);
	const channel = useMemo(() => screen ?? createScreenChannel(), [screen]);
	const base = useMemo<Omit<AdminContext, "session">>(
		() => ({
			screen: channel,
			...writes,
			transport,
			streams: streams ?? httpStreams(apiBase),
			uploader: uploader ?? httpUploader(apiBase),
			language: shownLanguage,
			siteName: shownName,
			siteNameDefault: siteName,
			templates: face.templates,
			setFace,
			apiBase,
			blocks: new Map(blocks.map((block) => [block.type, block])),
			// The first plugin to bring a name has it: a second one under the same name is not drawn in its place.
			inputs: new Map(plugins.flatMap((plugin) => Object.entries(plugin.inputs ?? {})).reverse()),
			views: new Map(plugins.flatMap((plugin) => Object.entries(plugin.views ?? {})).reverse()),
			toolPages: new Map(
				plugins.flatMap((plugin) =>
					Object.entries(plugin.toolPages ?? {}).map(([id, screen]) => [`${plugin.name}/${id}`, screen] as const),
				),
			),
			documentViews: plugins.flatMap((plugin) =>
				(plugin.documentViews ?? []).map((view) => ({ ...view, key: `${plugin.name}/${view.id}` })),
			),
			t: (message, values) => wordsOf(shownLanguage, message, values),
		}),
		[
			transport,
			streams,
			uploader,
			shownLanguage,
			shownName,
			siteName,
			face.templates,
			apiBase,
			channel,
			writes,
			blocks,
			plugins,
		],
	);
	// Apart from the rest, so the session ending does not make the write notices and the screens' reads anew.
	const value = useMemo<AdminContext>(() => ({ ...base, session }), [base, session]);
	return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAdmin(): AdminContext {
	const context = useContext(Context);
	if (!context) throw new Error("The admin's screens need an <AdminProvider>.");
	return context;
}
