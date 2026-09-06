-- Re-run the Draft tier calculation after installing the common operation model.
select * from public.refresh_venue_priority_tiers(current_date);
