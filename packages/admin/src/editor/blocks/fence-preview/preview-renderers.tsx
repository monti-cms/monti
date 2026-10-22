"use client";

// design-system: drawing — rendered previews (diagram, formula) are drawn inside the document in the block's own look

import { useTranslator } from "@monti-cms/core/site";
import { cn } from "@monti-cms/ui";
import { Component, type ComponentType, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { useAdminComponents } from "../../../admin-components";
import { blocksMessages } from "../messages";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: (error: Error) => ReactNode;
	resetKey?: unknown;
}

interface ErrorBoundaryState {
	error: Error | null;
}

export class PreviewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	override state: ErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("Preview render error:", error, errorInfo);
	}

	override componentDidUpdate(prevProps: ErrorBoundaryProps) {
		if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
			this.setState({ error: null });
		}
	}

	override render() {
		if (this.state.error) {
			if (this.props.fallback) {
				return this.props.fallback(this.state.error);
			}
			return (
				<div className="rounded-md border border-monti-danger-muted bg-monti-danger-muted p-normal font-mono text-monti-caption text-monti-danger">
					{this.state.error.message}
				</div>
			);
		}
		return this.props.children;
	}
}

/**
 * Loads and renders the fence preview the site provided (`AdminComponents.fencePreviews`). If none was provided, shows the raw source as is.
 */
export function LazyFencePreview({
	lang,
	label,
	value,
	className,
	emptyText,
}: {
	lang: string;
	label: string;
	value: string;
	className?: string;
	emptyText: string;
}) {
	const t = useTranslator(blocksMessages);
	const load = useAdminComponents().fencePreviews?.[lang];
	const [Renderer, setRenderer] = useState<ComponentType<{ source: string; className?: string }> | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		if (!load) return;
		let cancelled = false;
		load()
			.then((component) => {
				if (!cancelled) setRenderer(() => component);
			})
			.catch((err: unknown) => {
				if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
			});
		return () => {
			cancelled = true;
		};
	}, [load]);

	const trimmed = value.trim();
	if (!load) {
		return (
			<pre
				className={cn("overflow-x-auto whitespace-pre-wrap font-mono text-monti-caption text-monti-muted", className)}
			>
				{trimmed || emptyText}
			</pre>
		);
	}
	if (loadError) {
		return (
			<div className="rounded-md border border-monti-danger-muted bg-monti-danger-muted p-normal font-mono text-monti-caption text-monti-danger">
				{t("preview.loadFailed", { label, error: loadError })}
			</div>
		);
	}
	if (!Renderer) {
		return (
			<div className="py-condensed text-center text-monti-caption text-monti-muted">
				{t("preview.loading", { label })}
			</div>
		);
	}
	if (!trimmed) {
		return <div className="py-condensed text-center text-monti-caption text-monti-muted italic">{emptyText}</div>;
	}
	return (
		<PreviewErrorBoundary resetKey={trimmed}>
			<div
				className={cn(
					"w-full min-w-0 overflow-x-auto [&_[data-error=true]]:text-monti-danger [&_[data-error=true]_span]:text-monti-danger",
					className,
				)}
			>
				<Renderer source={trimmed} />
			</div>
		</PreviewErrorBoundary>
	);
}

export function MathPreview({ value, className }: { value: string; className?: string }) {
	const t = useTranslator(blocksMessages);
	const trimmed = value.trim();
	const [html, setHtml] = useState<string>("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		if (!trimmed) {
			setHtml("");
			setError(null);
			return;
		}

		import("katex")
			.then((katexModule) => {
				if (cancelled) return;
				try {
					const katex = katexModule.default ?? katexModule;
					const rendered = katex.renderToString(trimmed, {
						displayMode: true,
						throwOnError: true,
					});
					setHtml(rendered);
					setError(null);
				} catch (err: unknown) {
					setError(err instanceof Error ? err.message : String(err));
					setHtml("");
				}
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : String(err));
					setHtml("");
				}
			});

		return () => {
			cancelled = true;
		};
	}, [trimmed]);

	if (error) {
		return (
			<div className="rounded-md border border-monti-danger-muted bg-monti-danger-muted p-normal font-mono text-monti-caption text-monti-danger">
				{error}
			</div>
		);
	}

	if (!value.trim()) {
		return (
			<div className="py-condensed text-center text-monti-caption text-monti-muted italic">{t("math.placeholder")}</div>
		);
	}

	return (
		<PreviewErrorBoundary resetKey={trimmed}>
			<div
				className={cn("overflow-x-auto py-condensed text-center", className)}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: katex produces safe display math markup
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</PreviewErrorBoundary>
	);
}
