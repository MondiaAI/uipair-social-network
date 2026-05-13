import { Link } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

type SettingsRouteLinkProps = {
  className?: string;
  children?: ReactNode;
  onBeforeNavigate?: () => void;
  showIcon?: boolean;
};

export function SettingsRouteLink({
  className,
  children = "Settings",
  onBeforeNavigate,
  showIcon = true,
}: SettingsRouteLinkProps) {
  return (
    <Link
      to="/settings"
      className={className}
      onClick={() => {
        onBeforeNavigate?.();
      }}
    >
      {showIcon && <SettingsIcon className="h-4 w-4" />}
      {children}
    </Link>
  );
}

type SettingsButtonProps = {
  className?: string;
  label?: string;
  onBeforeNavigate?: () => void;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
};

export function SettingsButton({
  className,
  label = "Settings",
  onBeforeNavigate,
  size = "sm",
  variant = "outline",
}: SettingsButtonProps) {
  return (
    <Button size={size} variant={variant} asChild className={className}>
      <SettingsRouteLink onBeforeNavigate={onBeforeNavigate}>{label}</SettingsRouteLink>
    </Button>
  );
}