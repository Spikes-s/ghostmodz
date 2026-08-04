import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Award, Printer } from "lucide-react";
import { getAcademyOverview } from "@/lib/academy.functions";
import { BrandedLoader } from "@/components/ghost/BrandedLoader";

export const Route = createFileRoute("/_authenticated/academy/certificate/$code")({
  head: () => ({
    meta: [
      { title: "Certificate of Completion — Ghost Modz Academy" },
      { name: "description", content: "Verified Ghost Modz Academy certificate of completion." },
      { property: "og:title", content: "Certificate of Completion — Ghost Modz Academy" },
      { property: "og:description", content: "Verified Ghost Modz Academy certificate of completion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CertificatePage,
});

function CertificatePage() {
  const { code } = Route.useParams();
  const fn = useServerFn(getAcademyOverview);
  const { data, isLoading } = useQuery({ queryKey: ["academy-overview"], queryFn: () => fn() });

  if (isLoading) return <BrandedLoader label="Loading certificate…" />;
  const cert = ((data?.certificates ?? []) as any[]).find((c) => c.certificate_code === code);
  if (!cert) return <div className="p-10 text-center text-muted-foreground">Certificate not found.</div>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="glass-card neon-border rounded-2xl p-10 text-center print:bg-white">
        <Award className="mx-auto mb-4 h-12 w-12 text-primary" />
        <p className="font-mono text-xs tracking-[0.4em] text-secondary">GHOST MODZ ACADEMY</p>
        <h1 className="mt-3 text-3xl font-bold neon-text">Certificate of Completion</h1>
        <p className="mt-8 text-sm text-muted-foreground">This certifies that</p>
        <p className="text-2xl font-bold">{cert.student_name}</p>
        <p className="mt-4 text-sm text-muted-foreground">has successfully completed</p>
        <p className="text-xl font-semibold text-primary">{cert.course_title}</p>
        <div className="mt-10 flex flex-wrap justify-between gap-4 text-left text-xs text-muted-foreground">
          <div>
            <p className="uppercase tracking-widest">Issued</p>
            <p className="text-foreground">{new Date(cert.issued_at).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="uppercase tracking-widest">Certificate ID</p>
            <p className="font-mono text-foreground">{cert.certificate_code}</p>
          </div>
          <div>
            <p className="uppercase tracking-widest">Academy signature</p>
            <p className="text-foreground">Ghost Mods Tech</p>
          </div>
        </div>
      </div>
      <Button onClick={() => window.print()} className="mt-6 w-full gap-2 glow-purple">
        <Printer className="h-4 w-4" /> Download / print as PDF
      </Button>
    </div>
  );
}
