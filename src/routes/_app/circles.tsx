import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_app/circles")({
  component: () => <Placeholder />,
});

function Placeholder() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
        <Users className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold">Study Circles</h1>
      <p className="mt-2 text-muted-foreground">Coming soon — join subject-based study groups.</p>
    </div>
  );
}
