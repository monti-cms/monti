import { BlogListPage, generateBlogListMetadata } from "@/components/monti/blog-theme/blog-list";

// Route segment settings are written here, not re-exported: the posts are read from the database on each request.
export const dynamic = "force-dynamic";

export const generateMetadata = generateBlogListMetadata;

export default BlogListPage;
