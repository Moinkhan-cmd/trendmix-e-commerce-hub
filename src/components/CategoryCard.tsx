import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

interface CategoryCardProps {
  title: string;
  description: string;
  image: string;
  icon: LucideIcon;
  href: string;
}

const CategoryCard = ({ title, description, image, icon: Icon, href }: CategoryCardProps) => {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const [transform, setTransform] = useState("");
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 15;
    const rotateY = (centerX - x) / 15;
    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`);
  };

  const handleMouseLeave = () => {
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
    setIsHovered(false);
  };

  return (
    <Link
      ref={cardRef}
      to={href}
      className="group relative overflow-hidden rounded-xl bg-card border border-border transition-all duration-500 block preserve-3d"
      style={{
        transform,
        transition: "transform 0.15s ease-out, box-shadow 0.3s ease",
        boxShadow: isHovered ? "0 30px 60px -15px rgba(0, 0, 0, 0.3)" : "0 10px 40px -15px rgba(0, 0, 0, 0.1)",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      <div className="aspect-square overflow-hidden">
        <img src={image} alt={title} className="h-full w-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-2" style={{ transformOrigin: "center center" }} />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: "linear-gradient(45deg, hsl(351 83% 64% / 0.2), hsl(180 51% 52% / 0.2))" }} />
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/50 to-transparent flex flex-col justify-end p-6" style={{ transform: "translateZ(20px)" }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 backdrop-blur-sm border border-primary/20 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110 group-hover:rotate-6" style={{ transform: "translateZ(30px)" }}>
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-xl font-semibold transition-transform duration-300 group-hover:translate-x-1" style={{ transform: "translateZ(25px)" }}>{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground transition-all duration-300 group-hover:text-foreground" style={{ transform: "translateZ(15px)" }}>{description}</p>

        <div className="absolute bottom-6 right-6 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0 translate-x-4" style={{ transform: "translateZ(40px)" }}>
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </Link>
  );
};

export default CategoryCard;
