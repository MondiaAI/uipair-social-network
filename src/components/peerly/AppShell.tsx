import { ReactNode } from "react";
import { Header } from "./Header";
import { AppNav } from "./AppNav";
import { PaymentTestModeBanner } from "./PaymentTestModeBanner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <Header />
      <div className="mx-auto flex max-w-7xl">
        <AppNav />
        <main className="flex-1 min-w-0 pb-20 md:pb-8">{children}</main>
      </div>
    </div>
  );
}

