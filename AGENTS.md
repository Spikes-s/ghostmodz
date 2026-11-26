<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Keep persistent WhatsApp linked-device sockets in the separately deployed Node service; the Lovable app only brokers authenticated owner controls because its server runtime is short-lived.
- Encrypt linked-device credentials at rest in the service and keep its control token and encryption key out of the dashboard and source code.
- Render the decorative circuit scene in a client-only WebGL layer with reduced-motion and low-power fallbacks so it never blocks page content.
