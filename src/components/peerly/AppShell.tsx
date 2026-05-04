import { ReactNode } from "react";
import { Header } from "./Header";
import { AppNav } from "./AppNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto flex max-w-7xl">
        <AppNav />
        <main className="flex-1 pb-20 md:pb-8">{children}</main>
      </div>
    </div>
  );
}
