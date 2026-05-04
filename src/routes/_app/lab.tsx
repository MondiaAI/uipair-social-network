import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";

export const Route = createFileRoute("/_app/lab")({
  component: () => (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
        <FlaskConical className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold">The Lab</h1>
      <p className="mt-2 text-muted-foreground">Coming soon — live study sessions and bounties.</p>
    </div>
  ),
});
