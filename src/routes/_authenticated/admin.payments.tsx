import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  return (
    <Card className="glass-card border-border/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5 text-primary" /> Payments
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center py-12">
        <Sparkles className="mx-auto h-10 w-10 text-primary mb-3 animate-pulse-glow" />
        <p className="text-sm text-muted-foreground">
          Payment provider integration coming soon. This panel is reserved for subscription
          management, billing, and transaction history.
        </p>
      </CardContent>
    </Card>
  );
}
