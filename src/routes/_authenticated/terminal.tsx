import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Terminal } from "@/components/ghost/Terminal";

export const Route = createFileRoute("/_authenticated/terminal")({
  head: () => ({ meta: [{ title: "Live Terminal — Ghost Mods Tech" }] }),
  component: TerminalPage,
});

function TerminalPage() {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 top-14 bg-black">
      <Terminal
        files={[
          { path: "README.md", content: "# Ghost Shell\n\nWelcome to the live terminal.\nType `help` for commands." },
          { path: "src/index.ts", content: "console.log('Ghost Mods Tech');" },
        ]}
        projectName="ghost-shell"
        onClose={() => navigate({ to: "/" })}
      />
    </div>
  );
}
