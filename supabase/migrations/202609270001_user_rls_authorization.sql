revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_preferences from anon, authenticated;
revoke all on table public.user_saved_items from anon, authenticated;
revoke all on table public.user_seen_items from anon, authenticated;
revoke all on table public.user_favorite_items from anon, authenticated;
revoke all on table public.user_artwall_settings from anon, authenticated;
revoke all on table public.user_artwall_items from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, update on table public.user_preferences to authenticated;
grant select, insert, delete on table public.user_saved_items to authenticated;
grant select, insert, delete on table public.user_seen_items to authenticated;
grant select, insert, delete on table public.user_favorite_items to authenticated;
grant select, insert, update on table public.user_artwall_settings to authenticated;
grant select, insert, update, delete on table public.user_artwall_items to authenticated;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_preferences_select_own
on public.user_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_preferences_update_own
on public.user_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_saved_items_select_own
on public.user_saved_items
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_saved_items_insert_own
on public.user_saved_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy user_saved_items_delete_own
on public.user_saved_items
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy user_seen_items_select_own
on public.user_seen_items
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_seen_items_insert_own
on public.user_seen_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy user_seen_items_delete_own
on public.user_seen_items
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy user_favorite_items_select_own
on public.user_favorite_items
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_favorite_items_insert_own
on public.user_favorite_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy user_favorite_items_delete_own
on public.user_favorite_items
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy user_artwall_settings_select_own
on public.user_artwall_settings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_artwall_settings_insert_own
on public.user_artwall_settings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy user_artwall_settings_update_own
on public.user_artwall_settings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_artwall_items_select_own
on public.user_artwall_items
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_artwall_items_insert_own
on public.user_artwall_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy user_artwall_items_update_own
on public.user_artwall_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_artwall_items_delete_own
on public.user_artwall_items
for delete
to authenticated
using ((select auth.uid()) = user_id);
