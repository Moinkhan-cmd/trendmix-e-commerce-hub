import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

interface CategoryCardProps {
  title: string;
  description: string;
  image: string;
  icon: LucideIcon;
  href: string;
}

const CategoryCard = ({ title, description, image, icon: Icon, href }: CategoryCardProps) => {
  return (
    <Link
      to={href}
      className="group relative block overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`Browse ${title}`}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />
      
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition-all duration-700 group-hover:scale-110"
          loading="lazy"
          decoding="async"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        {/* Top badge with enhanced styling */}
        <div className="absolute left-3 top-3 sm:left-4 sm:top-4 inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/70 px-3 py-1.5 backdrop-blur-md shadow-lg transition-all duration-300 group-hover:bg-background/90 group-hover:border-primary/30">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 shadow-inner">
            <Icon className="h-4 w-4 text-primary" />
          </span>
          <span className="text-sm font-medium">{title}</span>
        </div>

        {/* Bottom content with enhanced styling */}
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-bold leading-tight tracking-tight">{title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
            </div>
            <span className="flex-shrink-0 inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-border/50 bg-background/70 backdrop-blur-sm opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:translate-x-0 translate-x-3 shadow-lg group-hover:bg-primary group-hover:border-primary group-hover:text-primary-foreground">
              <ChevronRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default CategoryCard;
