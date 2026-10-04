"use client";

import { createTranslator } from "@monti-cms/core/client";
import { Component, type ComponentType, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { useCmsAdminComponents } from "../../../admin-components";
import { cn } from "../../../lib/utils/cn";
import { blocksMessages } from "../messages";

const t = createTranslator(blocksMessages);

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
				<div className="rounded-md border border-cms-destructive/40 bg-cms-destructive/10 p-3 font-mono text-cms-destructive text-xs">
					{this.state.error.message}
				</div>
			);
		}
		return this.props.children;
	}
}

/**
 * 사이트가 넣은 펜스 미리보기(`CmsAdminComponents.fencePreviews`)를 불러와 그린다. 넣지 않았으면 원문을 그대로 보인다.
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
	const load = useCmsAdminComponents().fencePreviews?.[lang];
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
			<pre className={cn("overflow-x-auto whitespace-pre-wrap font-mono text-cms-muted-foreground text-xs", className)}>
				{trimmed || emptyText}
			</pre>
		);
	}
	if (loadError) {
		return (
			<div className="rounded-md border border-cms-destructive/40 bg-cms-destructive/10 p-3 font-mono text-cms-destructive text-xs">
				{t("preview.loadFailed", { label, error: loadError })}
			</div>
		);
	}
	if (!Renderer) {
		return <div className="py-2 text-center text-cms-muted-foreground text-xs">{t("preview.loading", { label })}</div>;
	}
	if (!trimmed) {
		return <div className="py-2 text-center text-cms-muted-foreground text-xs italic">{emptyText}</div>;
	}
	return (
		<PreviewErrorBoundary resetKey={trimmed}>
			<div
				className={cn(
					"w-full min-w-0 overflow-x-auto [&_[data-error=true]]:text-cms-destructive [&_[data-error=true]_span]:text-cms-destructive",
					className,
				)}
			>
				<Renderer source={trimmed} />
			</div>
		</PreviewErrorBoundary>
	);
}

export function MathPreview({ value, className }: { value: string; className?: string }) {
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
			<div className="rounded-md border border-cms-destructive/40 bg-cms-destructive/10 p-3 font-mono text-cms-destructive text-xs">
				{error}
			</div>
		);
	}

	if (!value.trim()) {
		return <div className="py-2 text-center text-cms-muted-foreground text-xs italic">{t("math.placeholder")}</div>;
	}

	return (
		<PreviewErrorBoundary resetKey={trimmed}>
			<div
				className={cn("overflow-x-auto py-2 text-center", className)}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: katex produces safe display math markup
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</PreviewErrorBoundary>
	);
}
