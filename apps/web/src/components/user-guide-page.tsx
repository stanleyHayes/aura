import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  Compass,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@cbs/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@cbs/ui/components/card";
import { PageHeader } from "@/components/page-header";
import { PageHelp } from "@/components/page-help";
import { groupedPageGuides, type PageGuide } from "@/lib/page-guides";
import { route } from "@/lib/route";

const SECTION_ICON = {
  "Requester workspace": Compass,
  "Admin console": ShieldCheck,
  Account: LayoutDashboard,
} satisfies Record<PageGuide["section"], typeof Compass>;

const GUIDE_HELP_STEPS = [
  "Choose the area you are working in: requester workspace, admin console, or account.",
  "Open the page guide for the task you want to complete and follow the numbered steps.",
  "Use the page link when you are ready to perform that task in AURA.",
];

function guideHref(guide: PageGuide, basePath: "/app" | "/admin") {
  if (guide.section === "Account") {
    return guide.href.replace("/app", basePath);
  }
  return guide.href;
}

export function UserGuidePage({ basePath }: { basePath: "/app" | "/admin" }) {
  const groups = groupedPageGuides();

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="User guide"
        description="A dedicated guide to the main AURA workflows and what to do on each page."
        help={
          <PageHelp
            title="How to use the user guide"
            pageTitle="User guide"
            description="A dedicated guide to the main AURA workflows and what to do on each page."
            steps={GUIDE_HELP_STEPS}
          />
        }
      />

      <div className="grid gap-6">
        {(Object.keys(groups) as PageGuide["section"][]).map((section) => {
          const guides = groups[section];
          const Icon = SECTION_ICON[section];
          return (
            <section key={section} aria-labelledby={`guide-${section}`}>
              <div className="mb-3 flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-maroon-tint)] text-[var(--color-maroon)]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2
                    id={`guide-${section}`}
                    className="text-xl font-semibold tracking-tight text-[var(--color-foreground)]"
                  >
                    {section}
                  </h2>
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    Practical steps for this area of AURA.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {guides.map((guide) => (
                  <Card key={guide.key} className="flex h-full flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle>{guide.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {guide.description}
                          </CardDescription>
                        </div>
                        <ClipboardList
                          className="mt-1 size-5 shrink-0 text-[var(--color-muted-foreground)]"
                          aria-hidden="true"
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-4 pt-0">
                      <ol className="grid gap-3 text-sm leading-6 text-[var(--color-muted-foreground)]">
                        {guide.steps.map((step, index) => (
                          <li key={step} className="flex gap-3">
                            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[var(--color-muted)] text-xs font-semibold text-[var(--color-foreground)]">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                      <div className="mt-auto">
                        <Button asChild variant="outline" size="sm">
                          <Link href={route(guideHref(guide, basePath))}>
                            Open page
                            <ChevronRight className="size-4" aria-hidden="true" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
