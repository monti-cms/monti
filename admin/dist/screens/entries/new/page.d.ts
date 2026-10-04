interface PageProps {
    searchParams: Promise<{
        collection?: string;
        folder?: string;
    }>;
}
export default function NewEntryPage({ searchParams }: PageProps): Promise<import("react").JSX.Element>;
export {};
