import { coreMessages, formatMessage, type Message, type MessageBundle } from "@monti-cms/core";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { adminMessages } from "../messages";
import type { Transport } from "./transport";

export type Language = "ko" | "en";

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
	language: Language;
	/** The site's name over the sidebar and the login form. */
	siteName: string;
	/** Where the admin API is mounted (`/admin/api`): the GitHub sign-in is a page the browser goes to there. */
	apiBase: string;
	/** Tells the screens a write went through, so what they show from other reads (the sidebar's counts) is read again. */
	wrote: () => void;
	onWrite: (listener: () => void) => () => void;
	screen: ScreenChannel;
	/** The admin's words in its language: a key of the admin's or the core's dictionary, with its values. */
	t: (message: Message | string, values?: Message["values"]) => string;
};

const Context = createContext<AdminContext | null>(null);

const BUNDLES: MessageBundle[] = [adminMessages, coreMessages];

export function AdminProvider({
	transport,
	language = "ko",
	siteName,
	apiBase = "/admin/api",
	screen,
	children,
}: {
	transport: Transport;
	language?: Language;
	siteName: string;
	apiBase?: string;
	/** The assistant's way to the screen; one of its own by default. */
	screen?: ScreenChannel;
	children: ReactNode;
}) {
	const value = useMemo<AdminContext>(() => {
		const listeners = new Set<() => void>();
		return {
			screen: screen ?? createScreenChannel(),
			wrote: () => {
				for (const listener of listeners) listener();
			},
			onWrite: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			transport,
			language,
			siteName,
			apiBase,
			t: (message, values) =>
				formatMessage(BUNDLES, language, typeof message === "string" ? { key: message, values } : message),
		};
	}, [transport, language, siteName, apiBase, screen]);
	return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAdmin(): AdminContext {
	const context = useContext(Context);
	if (!context) throw new Error("The admin's screens need an <AdminProvider>.");
	return context;
}
