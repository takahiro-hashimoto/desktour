import { ReactNode } from "react";

type PageHeaderVariant = "default" | "large" | "small";

interface PageHeaderProps {
  title: string | ReactNode;
  subtitle?: string | ReactNode;
  label?: string; // "DATABASE REPORT" などのラベル
  variant?: PageHeaderVariant;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  label = "DATABASE REPORT",
  variant = "default",
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`mb-8 ${className}`}>
      {label && variant !== "small" && (
        <p className="text-xs text-gray-400 tracking-wider uppercase mb-2">
          {label}
        </p>
      )}
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h1>
      {subtitle && (
        <p className="text-base md:text-lg text-gray-600">{subtitle}</p>
      )}
    </div>
  );
}
