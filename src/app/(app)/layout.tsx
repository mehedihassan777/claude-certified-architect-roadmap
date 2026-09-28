import { redirect } from "next/navigation";
import { ProgressProvider } from "@/client/progress-provider";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { WEEKS } from "@/lib/content";
import { buildContentIndex } from "@/lib/content/summary";

const CONTENT_INDEX = buildContentIndex(WEEKS);

/** Every page in this group needs a signed-in user; the proxy redirects first, this is the backstop. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <ProgressProvider index={CONTENT_INDEX}>
      <SiteHeader user={{ email: user.email, isAdmin: user.isAdmin }} />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
        {children}
      </main>
    </ProgressProvider>
  );
}
