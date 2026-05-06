import { ReactNode } from "react";
import { UiPairLogo, UiPairMark } from "./UiPairLogo";
import { Link } from "@tanstack/react-router";

const CAPTIONS: { title: string; body: string }[] = [
  { title: "Your campus. Every campus.", body: "Connect with students at your university and beyond." },
  { title: "Find your study partner", body: "Match by subject, schedule, and goals — never grind alone." },
  { title: "Earn from what you know", body: "Tutor, sell notes, or claim bounties on StudyGigs." },
  { title: "Build with your peers", body: "Spin up projects, hackathons, and research crews in The Lab." },
];

export function SplitAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background lg:grid lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-[#1C1847] text-[#EEEDFE] lg:flex lg:flex-col lg:justify-between lg:p-10">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#534AB7] opacity-40 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-[#7F77DD] opacity-30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#6460CC] opacity-30 blur-3xl" />

        <div className="relative z-10">
          <Link to="/" aria-label="UiPair home">
            <UiPairLogo size="lg" variant="dark" showTagline />
          </Link>
        </div>

        <div className="relative z-10 max-w-md space-y-8">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Where students meet, study, and ship — together.
          </h2>
          <ul className="space-y-5">
            {CAPTIONS.map((c) => (
              <li key={c.title} className="flex gap-3">
                <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
                  <UiPairMark size={20} variant="dark" />
                </span>
                <div>
                  <p className="font-medium text-[#EEEDFE]">{c.title}</p>
                  <p className="text-sm text-[#AFA9EC]">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-[#AFA9EC]">
          © {new Date().getFullYear()} UiPair · Built by students, for students.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden">
            <Link to="/"><UiPairLogo size="md" variant="light" /></Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
