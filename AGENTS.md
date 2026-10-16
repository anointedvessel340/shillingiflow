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

- Browser authentication uses the app-owned auth-client storage adapter; it selects supported session or persistent storage without changing generated integration files, so Remember me has real storage semantics.
- Server functions use attachAppAuth for bearer attachment from the same browser client; generated integration clients remain untouched.
- Sensitive operations require a five-minute database proof tied to validated user and session; UI confirmation alone never authorizes an operation.
- Password recovery accepts only recovery authentication, never an ordinary signed-in session, to prevent bypassing current-password checks.
