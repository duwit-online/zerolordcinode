import { Link } from "react-router-dom";
import { useFooterPages } from "@/hooks/useStaticPages";

const SiteFooter = () => {
  const { data: pages = [] } = useFooterPages();

  return (
    <footer className="py-8 px-4 border-t border-border/20 text-center text-xs text-muted-foreground">
      {pages.length > 0 && (
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-3">
          {pages.map(p => (
            <Link key={p.slug} to={`/p/${p.slug}`} className="hover:text-foreground transition-colors">
              {p.title}
            </Link>
          ))}
        </nav>
      )}
      <p>© {new Date().getFullYear()} Cinode. All rights reserved.</p>
    </footer>
  );
};

export default SiteFooter;
