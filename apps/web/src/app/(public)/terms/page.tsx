import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { IconWatermark } from "@/components/watermark";
import { route } from "@/lib/route";

// NOTE TO ASHESI: These Terms of Use are an engineering draft reflecting
// reasonable acceptable-use rules for booking university resources. They are NOT
// legal advice. Ashesi's legal function MUST review and approve this wording —
// including how it interacts with existing student/staff codes of conduct and
// IT-acceptable-use policies — before it is treated as binding.

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms governing use of AURA, Ashesi University's platform for reserving classrooms and campus facilities.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "30 June 2026";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-24 border-t border-[var(--color-border)] pt-8"
    >
      <h2
        id={`${id}-heading`}
        className="font-serif text-2xl font-semibold tracking-tight text-[var(--color-foreground)]"
      >
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--color-foreground)]/90">
        {children}
      </div>
    </section>
  );
}

export default function TermsOfUsePage() {
  return (
    <div className="relative overflow-hidden">
      <IconWatermark
        icon={ScrollText}
        className="right-[max(1rem,calc((100vw-72rem)/2))] top-10 hidden size-72 rotate-[-8deg] lg:block"
      />
      <div className="relative mx-auto w-full max-w-3xl px-4 py-16">
        <header className="mb-10 flex flex-col gap-5 border-b border-[var(--color-border)] pb-8 sm:flex-row sm:items-start sm:gap-6">
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon-tint)] text-[var(--color-maroon)] sm:size-16"
          >
            <ScrollText className="size-7" />
          </span>
          <div>
            <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-[var(--color-foreground)] sm:text-4xl">
              Terms of Use
            </h1>
            <p className="mt-3 text-base leading-7 text-[var(--color-muted-foreground)]">
              The rules for using AURA to reserve Ashesi University classrooms
              and campus facilities.
            </p>
            <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
              Last updated: {LAST_UPDATED}
            </p>
          </div>
        </header>

        <div className="space-y-10">
          <Section id="acceptance" title="1. Acceptance of these terms">
            <p>
              AURA — Ashesi University Resource Allocation is provided by Ashesi
              University (&ldquo;Ashesi&rdquo;, &ldquo;we&rdquo;) to help its
              community reserve classrooms and campus facilities. By signing in
              and using AURA you agree to these Terms of Use. If you do not
              agree, please do not use the platform.
            </p>
          </Section>

          <Section id="eligibility" title="2. Eligibility and your account">
            <p>
              AURA is for current Ashesi students, faculty and staff who sign in
              with their Ashesi credentials. You are responsible for activity
              under your account, for keeping your credentials secure, and for
              not sharing access with others. Notify us promptly of any
              unauthorised use.
            </p>
          </Section>

          <Section id="bookings" title="3. Making and honouring bookings">
            <p>By using AURA to reserve a space you agree to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Book only spaces and times you genuinely intend to use, for
                legitimate University-related purposes.
              </li>
              <li>
                Provide accurate information about the purpose, expected
                attendance and any equipment needs of your reservation.
              </li>
              <li>
                Cancel reservations you no longer need, in good time, so the
                space can be released to others.
              </li>
              <li>
                Respect that scheduled lectures and approved institutional uses
                take precedence, and that requests which conflict with them may
                be declined.
              </li>
              <li>
                Understand that a request is not confirmed until it is approved,
                and that approval may be subject to capacity, maintenance and
                competing demand.
              </li>
            </ul>
          </Section>

          <Section id="acceptable-use" title="4. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Make speculative, duplicate or fraudulent bookings, or hoard
                spaces to deny their use to others.
              </li>
              <li>
                Use a reserved space for any unlawful purpose or in breach of
                University policies, codes of conduct or safety rules.
              </li>
              <li>
                Attempt to bypass approvals, access data or controls you are not
                authorised to use, or interfere with the platform&rsquo;s
                security or operation.
              </li>
              <li>
                Enter content into booking fields that is unlawful, harassing,
                defamatory, or contains other people&rsquo;s sensitive personal
                data.
              </li>
              <li>
                Use automated means to access or scrape the platform without our
                permission.
              </li>
            </ul>
            <p>
              Your use of AURA is also governed by Ashesi&rsquo;s broader
              policies, including any IT acceptable-use policy and student or
              staff codes of conduct.
            </p>
          </Section>

          <Section id="availability" title="5. Availability and changes">
            <p>
              We work to keep AURA available and accurate, but we provide it on
              an &ldquo;as is&rdquo; basis and may change, suspend or withdraw
              features, or reassign or cancel reservations where operationally or
              institutionally necessary (for example, maintenance, emergencies or
              higher-priority University use). We will give reasonable notice
              where we can.
            </p>
          </Section>

          <Section id="privacy" title="6. Privacy">
            <p>
              We handle personal data in accordance with our{" "}
              <Link
                href={route("/privacy")}
                className="text-[var(--color-primary)] underline-offset-4 hover:underline"
              >
                Privacy Policy
              </Link>
              , which explains your rights under Ghana&rsquo;s Data Protection
              Act, 2012 (Act 843).
            </p>
          </Section>

          <Section id="liability" title="7. Responsibility and misuse">
            <p>
              To the extent permitted by law, Ashesi is not liable for indirect
              or consequential loss arising from use of, or inability to use,
              AURA. Misuse of the platform or of reserved spaces may result in
              withdrawal of booking privileges and referral under the relevant
              University disciplinary process.
            </p>
          </Section>

          <Section id="changes" title="8. Changes to these terms">
            <p>
              We may update these Terms from time to time. When we make material
              changes we will update the &ldquo;Last updated&rdquo; date above.
              Continued use of AURA after changes take effect means you accept the
              revised Terms.
            </p>
          </Section>

          <Section id="contact" title="9. Contact">
            <p>
              {/* NOTE TO ASHESI: confirm the correct support mailbox for AURA. */}
              Questions about these Terms can be sent to{" "}
              <a
                href="mailto:support@ashesi.edu.gh"
                className="text-[var(--color-primary)] underline-offset-4 hover:underline"
              >
                support@ashesi.edu.gh
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
