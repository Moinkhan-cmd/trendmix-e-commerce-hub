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
      className="group relative block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`Browse ${title}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />

        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 backdrop-blur">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </span>
          <span className="text-sm font-medium">{title}</span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold leading-tight">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/50 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 translate-x-2">
              <ChevronRight className="h-5 w-5 text-foreground" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default CategoryCard;
