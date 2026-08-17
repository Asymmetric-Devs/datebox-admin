import React from "react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: "default" | "success" | "warning" | "purple" | "danger";
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  variant = "default",
  className,
}) => {
  const variantStyles = {
    default: "border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60",
    success: "border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10",
    warning: "border-amber-200/60 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10",
    purple: "border-purple-200/60 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-950/10",
    danger: "border-red-200/60 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10",
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-subtle backdrop-blur-sm transition-all duration-200 hover:shadow-card",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {title}
        </span>
        {icon && (
          <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800/80 p-2 text-zinc-700 dark:text-zinc-300">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-heading">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-semibold",
              trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>

      {description && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">{description}</p>
      )}
    </div>
  );
};
