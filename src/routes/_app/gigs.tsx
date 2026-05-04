import { createFileRoute } from "@tanstack/react-router";
import { DollarSign } from "lucide-react";

export const Route = createFileRoute("/_app/gigs")({
  component: () => (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
        <DollarSign className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold">StudyGigs</h1>
      <p className="mt-2 text-muted-foreground">Coming soon — peer-to-peer tutoring marketplace.</p>
    </div>
  ),
});
