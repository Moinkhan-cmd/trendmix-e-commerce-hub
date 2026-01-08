import { useRef, useState, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface Card3DProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  glareEnabled?: boolean;
  glareMaxOpacity?: number;
  rotateIntensity?: number;
  scaleOnHover?: number;
}

export function Card3D({
  children,
  className,
  containerClassName,
  glareEnabled = true,
  glareMaxOpacity = 0.2,
  rotateIntensity = 15,
  scaleOnHover = 1.02,
}: Card3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * rotateIntensity;
    const rotateY = ((centerX - x) / centerX) * rotateIntensity;
    
    setTransform(
      `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scaleOnHover}, ${scaleOnHover}, ${scaleOnHover})`
    );
    
    if (glareEnabled) {
      setGlare({
        x: (x / rect.width) * 100,
        y: (y / rect.height) * 100,
        opacity: glareMaxOpacity,
      });
    }
  };

  const handleMouseLeave = () => {
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
    setGlare({ x: 50, y: 50, opacity: 0 });
  };

  return (
    <div className={cn("perspective-1000", containerClassName)}>
      <div
        ref={cardRef}
        className={cn(
          "relative overflow-hidden rounded-xl transition-shadow duration-300 preserve-3d",
          className
        )}
        style={{
          transform,
          transition: "transform 0.15s ease-out, box-shadow 0.3s ease",
          boxShadow: transform
            ? "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 30px -15px hsl(var(--primary) / 0.3)"
            : "0 10px 30px -10px rgba(0, 0, 0, 0.1)",
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {glareEnabled && (
          <div
            className="pointer-events-none absolute inset-0 z-10 rounded-xl"
            style={{
              background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,${glare.opacity}) 0%, transparent 60%)`,
              transition: "opacity 0.3s ease",
            }}
          />
        )}
        {children}
      </div>
    </div>
  );
}

interface FloatingElementProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  distance?: number;
}

export function FloatingElement({
  children,
  className,
  delay = 0,
  duration = 6,
  distance = 20,
}: FloatingElementProps) {
  return (
    <div
      className={cn("", className)}
      style={{
        animation: `float ${duration}s ease-in-out ${delay}s infinite`,
      }}
    >
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateZ(0); }
          50% { transform: translateY(-${distance}px) translateZ(20px); }
        }
      `}</style>
      {children}
    </div>
  );
}

interface ParallaxLayerProps {
  children: ReactNode;
  className?: string;
  depth?: number;
}

export function ParallaxLayer({
  children,
  className,
  depth = 1,
}: ParallaxLayerProps) {
  const scale = 1 + depth * 0.5;
  const translateZ = -depth * 100;

  return (
    <div
      className={cn("", className)}
      style={{
        transform: `translateZ(${translateZ}px) scale(${scale})`,
      }}
    >
      {children}
    </div>
  );
}

export function GlowOrb({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute rounded-full blur-3xl opacity-30 animate-pulse",
        className
      )}
      style={{
        background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
      }}
    />
  );
}
