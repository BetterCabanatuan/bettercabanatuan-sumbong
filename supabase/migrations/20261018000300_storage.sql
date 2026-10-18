-- Photo storage.
--   report-originals: photos exactly as Reporters sent them (EXIF already stripped). Private.
--   report-public:    copies a Volunteer cleared or blurred in Review, plus "after" photos. Public.
--   digest-proofs:    Proof of Receipt photos for sent Digests. Private.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('report-originals', 'report-originals', false, 5242880, array['image/jpeg']),
  ('report-public', 'report-public', true, 5242880, array['image/jpeg']),
  ('digest-proofs', 'digest-proofs', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Upserts (re-publishing a redacted copy) need SELECT on the public bucket too.
create policy "volunteers read photos" on storage.objects
  for select to authenticated
  using (bucket_id in ('report-originals', 'report-public', 'digest-proofs') and public.is_volunteer());

create policy "volunteers upload photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('report-originals', 'report-public', 'digest-proofs') and public.is_volunteer()
  );

create policy "volunteers replace public photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'report-public' and public.is_volunteer())
  with check (bucket_id = 'report-public' and public.is_volunteer());
