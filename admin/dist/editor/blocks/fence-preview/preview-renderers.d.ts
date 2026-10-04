import { Component, type ErrorInfo, type ReactNode } from "react";
interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: (error: Error) => ReactNode;
    resetKey?: unknown;
}
interface ErrorBoundaryState {
    error: Error | null;
}
export declare class PreviewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState;
    static getDerivedStateFromError(error: Error): ErrorBoundaryState;
    componentDidCatch(error: Error, errorInfo: ErrorInfo): void;
    componentDidUpdate(prevProps: ErrorBoundaryProps): void;
    render(): string | number | bigint | boolean | import("react").JSX.Element | Iterable<ReactNode> | Promise<string | number | bigint | boolean | Iterable<ReactNode> | import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>> | import("react").ReactPortal | null | undefined> | null | undefined;
}
/**
 * Loads and renders the fence preview the site provided (`CmsAdminComponents.fencePreviews`). If none was provided, shows the raw source as is.
 */
export declare function LazyFencePreview({ lang, label, value, className, emptyText, }: {
    lang: string;
    label: string;
    value: string;
    className?: string;
    emptyText: string;
}): import("react").JSX.Element;
export declare function MathPreview({ value, className }: {
    value: string;
    className?: string;
}): import("react").JSX.Element;
export {};
