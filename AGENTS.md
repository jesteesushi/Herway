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
- Private reports live in `incident_reports`; the public map reads only `published_incidents`, written by moderators with a generalised location. Why: precise locations and reporter identity must never reach public readers.
- Moderator permission is checked in the database (`is_moderator()` in RLS), roles live only in `user_roles`. Why: UI checks alone are bypassable.
- Map code (maplibre) is only loaded client-side via `src/components/ClientMap.tsx`. Why: maplibre touches `window` and breaks SSR.
- Signed-in pages live under `src/routes/_authenticated/`. Why: one gate handles redirects to `/auth`.
- `maplibre-gl` is excluded from Vite dependency pre-bundling, and map containers wrap the MapLibre element in an outer positioned div. Why: pre-bundling breaks its worker, and its CSS overrides positioning on the map element.
- Community rooms live under _authenticated/community; blocking is enforced in RLS via is_blocked(). Why: hidden content must not be fetchable.
