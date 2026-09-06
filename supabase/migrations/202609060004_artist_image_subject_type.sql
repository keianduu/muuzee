alter table public.source_image_candidates
  add column if not exists image_subject_type text
  check (image_subject_type is null or image_subject_type in (
    'portrait_photo', 'artist_at_work', 'self_portrait', 'portrait_artwork', 'other'
  ));

comment on column public.source_image_candidates.image_subject_type is
  'Conservative Artist image subject classification for human candidate review.';
