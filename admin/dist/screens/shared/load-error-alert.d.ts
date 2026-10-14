/** The one load-failure notice of a screen: what went wrong and a retry button. Give it margins through `className`. */
export declare function LoadErrorAlert({ message, onRetry, className, }: {
    message: string;
    onRetry?: () => void;
    className?: string;
}): import("react").JSX.Element;
