import { createFileRoute, Link } from "@tanstack/react-router";
import { PeerlyLogo } from "@/components/peerly/PeerlyLogo";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — UiPair" },
      { name: "description", content: "How UiPair collects, uses, and protects your personal data." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/"><PeerlyLogo size="sm" /></Link>
          <Link to="/login" className="text-sm text-primary hover:underline">Sign in</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 prose prose-neutral dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: May 4, 2026</p>

        <h2>1. Information We Collect</h2>
        <ul>
          <li><strong>Account data:</strong> name, email, password (hashed), university, country, field of study.</li>
          <li><strong>Profile data:</strong> avatar, bio, skills, interests.</li>
          <li><strong>Content:</strong> posts, comments, gigs, messages, resources you upload.</li>
          <li><strong>Usage data:</strong> log data, device, IP, and interaction events.</li>
          <li><strong>Payment data:</strong> processed by Flutterwave; we never store full card numbers.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To operate and personalize the Service (feed, recommendations, matching).</li>
          <li>To process payments and payouts on StudyGigs.</li>
          <li>To communicate updates, security alerts, and support messages.</li>
          <li>To detect abuse and enforce our Terms.</li>
        </ul>

        <h2>3. Sharing</h2>
        <p>We share data with service providers (hosting, payments, analytics) under contract, and when required by law. We do not sell your personal data.</p>

        <h2>4. Your Rights</h2>
        <p>You may access, correct, export, or delete your data at any time from settings, or by emailing <a href="mailto:privacy@UiPair.app">privacy@UiPair.app</a>. EU/UK users have rights under GDPR; California users under CCPA.</p>

        <h2>5. Data Retention</h2>
        <p>We retain account data while your account is active. Deleting your account removes personal data within 30 days, except where retention is required by law.</p>

        <h2>6. Security</h2>
        <p>We use encryption in transit, hashed passwords, and access controls. No system is 100% secure — report concerns to <a href="mailto:security@UiPair.app">security@UiPair.app</a>.</p>

        <h2>7. Cookies</h2>
        <p>We use essential cookies for authentication and optional cookies for analytics. You can control cookies via your browser.</p>

        <h2>8. Children</h2>
        <p>UiPair is not directed to children under 16. We do not knowingly collect data from them.</p>

        <h2>9. Changes</h2>
        <p>We will notify you of material changes by email or in-app notice.</p>

        <p className="mt-8 text-sm">See also our <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>.</p>
      </main>
    </div>
  );
}
