import { createFileRoute, Link } from "@tanstack/react-router";
import { PeerlyLogo } from "@/components/peerly/PeerlyLogo";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — UiPair" },
      { name: "description", content: "Read the UiPair Terms of Service governing use of our student collaboration platform." },
    ],
  }),
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/"><PeerlyLogo size="sm" /></Link>
          <Link to="/login" className="text-sm text-primary hover:underline">Sign in</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 prose prose-neutral dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: May 4, 2026</p>

        <h2>1. Acceptance of Terms</h2>
        <p>By creating an account or using UiPair ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>

        <h2>2. Eligibility</h2>
        <p>You must be at least 16 years old and a current or prospective student to use UiPair. You agree to provide accurate university and academic information.</p>

        <h2>3. Your Account</h2>
        <p>You are responsible for safeguarding your password and for all activity that occurs under your account. Notify us immediately of any unauthorized use.</p>

        <h2>4. User Content</h2>
        <p>You retain ownership of content you post (notes, posts, gigs, resources). By posting, you grant UiPair a non-exclusive, worldwide license to host, display, and distribute that content within the Service.</p>

        <h2>5. Acceptable Use</h2>
        <ul>
          <li>No academic dishonesty assistance (e.g. completing exams on behalf of others).</li>
          <li>No harassment, hate speech, or illegal content.</li>
          <li>No spam, scraping, or unauthorized commercial use.</li>
          <li>No infringement of intellectual property rights.</li>
        </ul>

        <h2>6. StudyGigs & Payments</h2>
        <p>Transactions on StudyGigs are between buyers and sellers. UiPair facilitates payments via Stripe and charges a service fee. Refunds are handled per our refund policy.</p>

        <h2>7. Termination</h2>
        <p>We may suspend or terminate accounts that violate these Terms. You may delete your account at any time from settings.</p>

        <h2>8. Disclaimer & Liability</h2>
        <p>The Service is provided "as is" without warranties. To the fullest extent permitted by law, UiPair is not liable for indirect or consequential damages.</p>

        <h2>9. Changes</h2>
        <p>We may update these Terms. Continued use after changes constitutes acceptance.</p>

        <h2>10. Contact</h2>
        <p>Questions? Email <a href="mailto:hello@UiPair.app">hello@UiPair.app</a>.</p>

        <p className="mt-8 text-sm">See also our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.</p>
      </main>
    </div>
  );
}
