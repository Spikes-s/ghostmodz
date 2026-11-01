import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Inbox, Mail, Phone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listEnquiries, setEnquiryStatus } from "@/lib/enquiries.functions";

export const Route = createFileRoute("/_authenticated/admin/enquiries")({
  component: EnquiriesPage,
});

const STATUS_STYLES: Record<string, string> = {
  new: "text-primary",
  contacted: "text-secondary",
  closed: "text-muted-foreground",
};

function EnquiriesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEnquiries);
  const statusFn = useServerFn(setEnquiryStatus);

  const { data: enquiries = [], isFetching, refetch } = useQuery({
    queryKey: ["admin-enquiries"],
    queryFn: () => listFn(),
  });

  async function mark(id: string, status: "new" | "contacted" | "closed") {
    try {
      await statusFn({ data: { id, status } });
      toast.success(`Marked as ${status}`);
      qc.invalidateQueries({ queryKey: ["admin-enquiries"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to update enquiry");
    }
  }

  const newCount = enquiries.filter((e: any) => e.status === "new").length;

  return (
    <Card className="glass-card border-border/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Inbox className="h-5 w-5 text-primary" />
          Service Enquiries
          {newCount > 0 && (
            <Badge className="ml-2">{newCount} new</Badge>
          )}
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          className="gap-2"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {enquiries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No enquiries yet. Submissions from the public site will appear here.
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {enquiries.map((e: any) => (
              <div key={e.id} className="py-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      {e.name}
                      {e.service_slug && (
                        <Badge variant="outline" className="text-xs">
                          {e.service_slug}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <a
                        href={`mailto:${e.email}`}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <Mail className="h-3 w-3" /> {e.email}
                      </a>
                      {e.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {e.phone}
                        </span>
                      )}
                      <span>
                        {new Date(e.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                      {e.message}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      variant="outline"
                      className={STATUS_STYLES[e.status] || ""}
                    >
                      {e.status}
                    </Badge>
                    <div className="flex gap-1">
                      {e.status === "new" && (
                        <Button size="sm" onClick={() => mark(e.id, "contacted")}>
                          Mark contacted
                        </Button>
                      )}
                      {e.status !== "closed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => mark(e.id, "closed")}
                        >
                          Close
                        </Button>
                      )}
                      {e.status !== "new" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => mark(e.id, "new")}
                        >
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
