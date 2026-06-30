import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { IconWatermark } from "@/components/watermark";
import { route } from "@/lib/route";

// NOTE TO ASHESI: This privacy notice is drafted to reflect the Data Protection
// Act, 2012 (Act 843) and good practice for a Ghanaian data controller. It is a
// good-faith engineering draft and is NOT legal advice. Ashesi's legal / data
// protection function MUST review and approve the wording, the named contacts,
// the retention periods and the registration status with the Data Protection
// Commission before this is treated as the institution's official policy.

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Ashesi University collects, uses, protects and shares personal data in AURA, the campus resource-allocation platform, and your rights under Ghana's Data Protection Act, 2012 (Act 843).",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "30 June 2026";

// Single point of contact for data-protection requests. NOTE TO ASHESI: confirm
// this mailbox is monitored and routes to the institution's data protection
// contact before launch.
const DPC_CONTACT_EMAIL = "dataprotection@ashesi.edu.gh";

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

const rights = [
  {
    name: "Right of access",
    body: "Request confirmation of whether we hold personal data about you and obtain a copy of that data, together with information about how it is processed.",
  },
  {
    name: "Right to correction",
    body: "Ask us to correct personal data that is inaccurate, misleading, out of date or incomplete.",
  },
  {
    name: "Right to deletion / blocking",
    body: "Ask us to delete or block personal data that we are no longer entitled to keep, subject to records we must retain by law or for legitimate institutional purposes.",
  },
  {
    name: "Right to object",
    body: "Object to processing of your personal data, including the prevention of processing likely to cause unwarranted damage or distress.",
  },
  {
    name: "Right to prevent direct marketing",
    body: "AURA does not use your data for marketing. If that ever changes you may require us to stop using your data for that purpose.",
  },
  {
    name: "Right to complain",
    body: "Lodge a complaint with us and, if unresolved, with Ghana's Data Protection Commission (see ‘Complaints’ below).",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="relative overflow-hidden">
      <IconWatermark
        icon={ShieldCheck}
        className="right-[max(1rem,calc((100vw-72rem)/2))] top-10 hidden size-72 rotate-[-8deg] lg:block"
      />
      <div className="relative mx-auto w-full max-w-3xl px-4 py-16">
        <header className="mb-10 flex flex-col gap-5 border-b border-[var(--color-border)] pb-8 sm:flex-row sm:items-start sm:gap-6">
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon-tint)] text-[var(--color-maroon)] sm:size-16"
          >
            <ShieldCheck className="size-7" />
          </span>
          <div>
            <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-[var(--color-foreground)] sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-3 text-base leading-7 text-[var(--color-muted-foreground)]">
              How Ashesi University handles your personal data in AURA, and your
              rights under Ghana&rsquo;s Data Protection Act, 2012 (Act 843).
            </p>
            <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
              Last updated: {LAST_UPDATED}
            </p>
          </div>
        </header>

        <div className="space-y-10">
          <Section id="controller" title="1. Who is responsible for your data">
            <p>
              Ashesi University (&ldquo;Ashesi&rdquo;, &ldquo;we&rdquo;,
              &ldquo;us&rdquo;) is the <strong>data controller</strong> for the
              personal data processed through AURA — Ashesi University Resource
              Allocation, the platform used to reserve classrooms and campus
              facilities. Ashesi University is located at 1 University Avenue,
              Berekuso, Eastern Region, Ghana.
            </p>
            <p>
              This notice explains what personal data AURA collects, why we
              collect it, the lawful basis for processing it, who we share it
              with, how long we keep it, and the rights you have under the Data
              Protection Act, 2012 (Act 843), which is administered by the Data
              Protection Commission of Ghana (the &ldquo;Commission&rdquo;).
            </p>
          </Section>

          <Section id="data" title="2. What personal data we collect">
            <p>We process the following categories of personal data:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Identity and contact data</strong> — your name and
                Ashesi email address, supplied by Ashesi&rsquo;s sign-in / single
                sign-on system when you authenticate.
              </li>
              <li>
                <strong>Affiliation data</strong> — your role (for example
                student, faculty, staff or booking officer) and, where relevant,
                your department or programme, used to determine what you may
                book and approve.
              </li>
              <li>
                <strong>Booking and activity data</strong> — the reservations
                you create or approve, including the room, date, time, purpose
                or notes you enter, attendee counts, and the status and history
                of each request.
              </li>
              <li>
                <strong>Technical data</strong> — limited information needed to
                operate the service securely and reliably, such as session
                identifiers and standard server logs.
              </li>
              <li>
                <strong>Local browser storage</strong> — small preference values
                stored in your browser (for example your theme choice and your
                acknowledgement of this notice). See &ldquo;Cookies and local
                storage&rdquo; below.
              </li>
            </ul>
            <p>
              AURA does not intentionally collect special categories of data
              (such as health, religion or political opinions). Please do not
              enter such information into free-text booking fields.
            </p>
          </Section>

          <Section id="purpose" title="3. Why we use your data and our lawful basis">
            <p>
              Under section 20 of Act 843 we process personal data only where it
              is necessary and we have a lawful basis. We rely on the following
              bases:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Performance of our function as your institution</strong>{" "}
                — to authenticate you, let you search availability, submit and
                manage reservations, route requests to the right approvers, and
                prevent double-booking of shared university resources.
              </li>
              <li>
                <strong>Legitimate institutional interests</strong> — to
                administer, secure and improve the platform, detect and resolve
                scheduling conflicts, and produce aggregate reports on facility
                utilisation.
              </li>
              <li>
                <strong>Legal obligation</strong> — to keep records we are
                required to retain and to comply with lawful requests from
                regulators or authorities.
              </li>
              <li>
                <strong>Consent</strong> — where we ask for it specifically (for
                example, optional preferences). Where processing is based on
                consent, you may withdraw it at any time without affecting prior
                processing.
              </li>
            </ul>
          </Section>

          <Section id="sharing" title="4. Who we share your data with">
            <p>We do not sell your personal data. We share it only as follows:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Within Ashesi</strong> — with booking officers,
                facilities staff and administrators who need it to review,
                approve, schedule or report on reservations.
              </li>
              <li>
                <strong>Other users, in limited form</strong> — the fact that a
                space is reserved (and, for approvers, who reserved it) may be
                visible to those administering the same space, so that conflicts
                can be resolved.
              </li>
              <li>
                <strong>Service providers (data processors)</strong> — trusted
                providers that host and operate the platform on our behalf under
                contracts that require them to protect your data and process it
                only on our instructions.
              </li>
              <li>
                <strong>Authorities</strong> — where we are legally required to
                disclose data, or to protect the rights, safety and property of
                the University community.
              </li>
            </ul>
            <p>
              Where data is processed or stored outside Ghana, we take steps
              consistent with Act 843 to ensure it remains adequately protected.
            </p>
          </Section>

          <Section id="retention" title="5. How long we keep your data">
            <p>
              We keep personal data only for as long as necessary for the
              purposes above. Booking records are retained for the period needed
              for facilities administration, dispute resolution and aggregate
              reporting, after which they are deleted or anonymised. Account and
              affiliation data is retained while you remain affiliated with
              Ashesi and for a reasonable period afterwards. Server logs are kept
              for a short operational period.
            </p>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {/* NOTE TO ASHESI: insert the University's approved, specific
              retention periods (in months/years) per data category here. */}
              Specific retention periods are set by Ashesi&rsquo;s records-management
              schedule and are available on request.
            </p>
          </Section>

          <Section id="security" title="6. How we protect your data">
            <p>
              In line with section 28 of Act 843 we apply appropriate technical
              and organisational measures to safeguard personal data against
              loss, unauthorised access, alteration and disclosure. These include
              authenticated access tied to your Ashesi identity, role-based
              access controls so people see only what their role requires,
              encryption of data in transit, server-side enforcement of booking
              rules, and restricted administrative access. No system can be
              guaranteed completely secure, but we work to reduce risk and to
              respond promptly to any incident.
            </p>
          </Section>

          <Section id="rights" title="7. Your rights under Act 843">
            <p>
              As a data subject under the Data Protection Act, 2012 (Act 843) you
              have the following rights in relation to your personal data:
            </p>
            <ul className="space-y-3">
              {rights.map((r) => (
                <li
                  key={r.name}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
                >
                  <p className="font-medium text-[var(--color-foreground)]">
                    {r.name}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-muted-foreground)]">
                    {r.body}
                  </p>
                </li>
              ))}
            </ul>
            <p>
              To exercise any of these rights, contact us using the details
              below. We will respond within the timeframe required by law. We may
              need to verify your identity before acting on a request.
            </p>
          </Section>

          <Section id="cookies" title="8. Cookies and local storage">
            <p>
              AURA uses a small number of strictly necessary cookies / session
              tokens to keep you signed in and to operate securely. It also uses
              your browser&rsquo;s local storage to remember non-essential
              preferences, such as your chosen theme and whether you have
              acknowledged this privacy notice (stored under the key{" "}
              <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[0.85em]">
                aura-privacy-ack
              </code>
              ).
            </p>
            <p>
              We do not use advertising or third-party tracking cookies. You can
              clear local storage and cookies at any time through your browser
              settings; doing so will sign you out and reset your preferences.
            </p>
          </Section>

          <Section id="complaints" title="9. Complaints and contacting the Commission">
            <p>
              If you have a concern about how your personal data is handled,
              please contact us first so we can try to resolve it. You also have
              the right to lodge a complaint with the Data Protection Commission
              of Ghana, the independent authority that supervises compliance with
              Act 843.
            </p>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm leading-6">
              <p className="font-medium text-[var(--color-foreground)]">
                Data Protection Commission (Ghana)
              </p>
              <p className="mt-1 text-[var(--color-muted-foreground)]">
                Website:{" "}
                <a
                  href="https://www.dataprotection.org.gh"
                  className="text-[var(--color-primary)] underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  www.dataprotection.org.gh
                </a>
              </p>
            </div>
          </Section>

          <Section id="contact" title="10. How to contact us">
            <p>
              For privacy questions or to exercise your rights, contact
              Ashesi&rsquo;s data protection point of contact:
            </p>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm leading-6">
              <p className="font-medium text-[var(--color-foreground)]">
                Data Protection Contact, Ashesi University
              </p>
              <p className="mt-1 text-[var(--color-muted-foreground)]">
                Email:{" "}
                <a
                  href={`mailto:${DPC_CONTACT_EMAIL}`}
                  className="text-[var(--color-primary)] underline-offset-4 hover:underline"
                >
                  {DPC_CONTACT_EMAIL}
                </a>
              </p>
              <p className="text-[var(--color-muted-foreground)]">
                Post: Ashesi University, 1 University Avenue, Berekuso, Eastern
                Region, Ghana.
              </p>
            </div>
          </Section>

          <Section id="changes" title="11. Changes to this notice">
            <p>
              We may update this notice from time to time. When we make material
              changes we will update the &ldquo;Last updated&rdquo; date above
              and, where appropriate, notify you. Please review it periodically.
            </p>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              See also our{" "}
              <Link
                href={route("/terms")}
                className="text-[var(--color-primary)] underline-offset-4 hover:underline"
              >
                Terms of Use
              </Link>
              .
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
