import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** "white" → tüm metin beyaz (koyu arka plan için) */
  variant?: "default" | "white";
  /** Sadece simge — yazısız */
  iconOnly?: boolean;
}

const sizes = {
  sm: "h-7",
  md: "h-9",
  lg: "h-12",
  xl: "h-16",
};

export function Logo({
  className,
  size = "md",
  variant = "default",
  iconOnly = false,
}: LogoProps) {
  const textColor = variant === "white" ? "#ffffff" : "currentColor";

  if (iconOnly) {
    return (
      <svg
        viewBox="0 0 76 76"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(sizes[size], "w-auto max-w-full", className)}
        aria-label="Psikoport"
        role="img"
      >
        <defs>
          <radialGradient id="psikoport-icon-only-grad" cx="38%" cy="36%" r="68%">
            <stop offset="0%" stopColor="#FB7185" />
            <stop offset="100%" stopColor="#BE123C" />
          </radialGradient>
        </defs>
        <g transform="translate(6, 8)">
          <circle cx="13" cy="11" r="10" fill="#FB7185" />
          <circle cx="13" cy="49" r="10" fill="#FB7185" />
          <circle cx="48" cy="30" r="16" fill="url(#psikoport-icon-only-grad)" />
          <path d="M13 21V39" stroke={textColor} strokeWidth="5.5" strokeLinecap="round" strokeOpacity={0.25} />
          <path d="M22 16.5L35 23" stroke={textColor} strokeWidth="5.5" strokeLinecap="round" strokeOpacity={0.25} />
          <path d="M22 43.5L35 37" stroke={textColor} strokeWidth="5.5" strokeLinecap="round" strokeOpacity={0.25} />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 330 76"
      width="330"
      height="76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(sizes[size], "w-auto max-w-full", className)}
      aria-label="Psikoport"
      role="img"
    >
      <defs>
        <radialGradient id="psikoport-node-grad" cx="38%" cy="36%" r="68%">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#BE123C" />
        </radialGradient>
      </defs>

      <g transform="translate(6, 8)">
        <circle cx="13" cy="11" r="10" fill="#FB7185" />
        <circle cx="13" cy="49" r="10" fill="#FB7185" />
        <circle cx="48" cy="30" r="16" fill="url(#psikoport-node-grad)" />
        <path d="M13 21V39" stroke={textColor} strokeWidth="5.5" strokeLinecap="round" strokeOpacity={0.25} />
        <path d="M22 16.5L35 23" stroke={textColor} strokeWidth="5.5" strokeLinecap="round" strokeOpacity={0.25} />
        <path d="M22 43.5L35 37" stroke={textColor} strokeWidth="5.5" strokeLinecap="round" strokeOpacity={0.25} />
      </g>

      <text
        x="86"
        y="52"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="40"
        fontWeight="800"
        fill={textColor}
        letterSpacing="-2"
      >
        Psikoport
      </text>

      <circle cx="304" cy="43" r="5.5" fill="#F43F5E" />
    </svg>
  );
}
