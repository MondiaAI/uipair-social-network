import { createFileRoute, Link } from "@tanstack/react-router";
import { PeerlyLogo } from "@/components/peerly/PeerlyLogo";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service & Purchaser Terms — UiPair" },
      { name: "description", content: "UiPair Terms of Service, eligibility (16+ and enrolled university students), and full purchaser/subscription terms." },
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
        <p className="text-sm text-muted-foreground">Last updated: May 11, 2026</p>

        <p>
          Welcome to UiPair. These Terms of Service ("Terms") form a binding
          agreement between you and UiPair governing your access to and use of
          our website, mobile interfaces, and related services (collectively,
          the "Service"). By creating an account or otherwise using the Service
          you confirm that you have read, understood, and agree to be bound by
          these Terms and our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          If you do not agree, do not use the Service.
        </p>

        <h2>1. Eligibility — 16+ and Enrolled at a University</h2>
        <p>
          UiPair is built exclusively for university students. To create an
          account or use the Service you represent and warrant that:
        </p>
        <ul>
          <li>You are at least <strong>16 years of age</strong>. If you are under the age of legal majority in your jurisdiction, you confirm that your parent or legal guardian has reviewed and accepted these Terms on your behalf.</li>
          <li>You are <strong>currently enrolled at, admitted to, or affiliated with a recognised university or higher-education institution</strong>, and the academic information you provide (university, programme, year of study) is true, accurate, and current.</li>
          <li>You have the legal capacity to enter into these Terms in your country of residence and are not barred from receiving the Service under applicable law.</li>
          <li>You have not previously been suspended or removed from the Service.</li>
        </ul>
        <p>
          We may, at any time, request reasonable verification of your age,
          identity, and university affiliation (e.g. a student email address or
          enrolment document). If you cannot or do not verify, we may suspend
          or terminate your account.
        </p>

        <h2>2. Your Account</h2>
        <p>
          You are responsible for safeguarding your credentials and for all
          activity under your account. Notify us immediately of any
          unauthorised use. One person, one account — accounts are not
          transferable.
        </p>

        <h2>3. User Content</h2>
        <p>
          You retain ownership of the content you post (notes, posts, gigs,
          resources, messages). By posting, you grant UiPair a non-exclusive,
          worldwide, royalty-free licence to host, store, display, reproduce,
          and distribute that content within the Service for the purpose of
          operating and improving it.
        </p>

        <h2>4. Acceptable Use</h2>
        <ul>
          <li>No academic dishonesty (e.g. sitting exams or completing graded assessments for others).</li>
          <li>No harassment, hate speech, threats, sexual content involving minors, or otherwise illegal content.</li>
          <li>No spam, scraping, reverse-engineering, or unauthorised commercial use.</li>
          <li>No infringement of intellectual property, privacy, or publicity rights.</li>
        </ul>

        <h2>5. StudyGigs & Marketplace</h2>
        <p>
          Transactions on StudyGigs and other marketplace surfaces are between
          buyers and sellers. UiPair facilitates payments via Stripe and may
          charge a service fee. Refunds are handled per our refund policy and
          applicable consumer law.
        </p>

        <h2>6. Termination</h2>
        <p>
          We may suspend or terminate accounts that violate these Terms or
          that fail eligibility verification. You may delete your account at
          any time from settings; certain content (e.g. messages sent to
          others) may persist for the recipients.
        </p>

        <h2>7. Disclaimer & Liability</h2>
        <p>
          The Service is provided "as is" and "as available" without warranties
          of any kind. To the fullest extent permitted by law, UiPair is not
          liable for indirect, incidental, special, consequential, or punitive
          damages, or loss of profits, data, or goodwill.
        </p>

        <h2>8. Changes</h2>
        <p>
          We may update these Terms from time to time. Material changes will be
          notified in-app or by email. Continued use after the effective date
          constitutes acceptance.
        </p>

        <h2>9. Contact</h2>
        <p>Questions? Email <a href="mailto:hello@UiPair.app">hello@UiPair.app</a>.</p>

        <hr className="my-10" />

        <h1 id="purchaser-terms">Purchaser Terms (UiPair Pro & Paid Subscriptions)</h1>
        <p className="text-sm text-muted-foreground">
          These Purchaser Terms apply whenever you start a free trial or
          purchase a paid subscription on UiPair (including UiPair Pro and
          premium Study Circles). They are part of, and incorporated into,
          the Terms of Service above.
        </p>

        <h2>A. Subscription & Pricing</h2>
        <ul>
          <li>UiPair Pro is offered at <strong>$4.00 USD per month</strong> or <strong>$35.00 USD per year</strong>. Prices for premium Study Circles are shown on each circle page.</li>
          <li>New users may be eligible for a <strong>7-day free trial</strong>. If you do not cancel before the trial ends, your selected plan will begin and your payment method will be charged automatically.</li>
          <li>All prices are exclusive of any applicable taxes (VAT/GST/sales tax), which will be added at checkout where required.</li>
        </ul>

        <h2>B. Auto-Renewal</h2>
        <p>
          <strong>Subscriptions automatically renew</strong> at the end of each billing
          period (monthly or yearly, as selected) at the then-current price,
          using the payment method on file, until you cancel. By subscribing,
          you expressly authorise UiPair and its payment processor (Stripe) to
          charge that payment method on a recurring basis.
        </p>

        <h2>C. Cancellation — at least 24 hours before renewal</h2>
        <p>
          You can cancel <strong>anytime</strong>, but you must cancel at least
          <strong> 24 hours before</strong> your current period ends to avoid being
          charged for the next period. Cancellations made within 24 hours of
          renewal may still be billed for the upcoming period; access continues
          through the end of the period you have already paid for.
        </p>

        <h2>D. Managing Your Subscription</h2>
        <p>
          Manage or cancel your subscription through the platform on which you
          originally subscribed:
        </p>
        <ul>
          <li>If you subscribed on the <strong>UiPair web app</strong>, manage your plan from your account settings or the customer billing portal linked there.</li>
          <li>If you subscribed through a <strong>third-party app store or platform</strong> (e.g. Apple App Store, Google Play), you must manage and cancel through that platform's subscription settings — UiPair cannot cancel or refund those subscriptions on your behalf.</li>
        </ul>

        <h2>E. Price Changes</h2>
        <p>
          <strong>Prices are subject to change.</strong> We will give you reasonable
          advance notice of any price change before it takes effect on your
          subscription. If you do not agree to the new price, you must cancel
          before it takes effect; continued use of the paid Service after the
          effective date constitutes acceptance of the new price.
        </p>

        <h2>F. Refunds</h2>
        <p>
          Except where required by applicable consumer law (including, where
          applicable, EU/UK statutory withdrawal rights), payments are
          <strong> non-refundable</strong> and we do not provide refunds or credits for
          partially used periods, downgrades, or unused time after cancellation.
        </p>

        <h2>G. Failed Payments</h2>
        <p>
          If a renewal payment fails, we (via Stripe) may retry the charge.
          If payment cannot be collected, your paid features may be paused or
          downgraded to the free tier until the balance is settled.
        </p>

        <h2>H. Acknowledgement</h2>
        <p>
          By starting a free trial or paid subscription you confirm that you
          have read and agree to these Purchaser Terms, you authorise the
          recurring charges described above, and you understand how to cancel
          and where to manage your subscription.
        </p>

        <p className="mt-10 text-sm">
          See also our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  );
}
