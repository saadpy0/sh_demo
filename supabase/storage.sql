-- Public catalog photos. Run once in the new project's SQL editor,
-- then: npm run catalog:images:upload

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog',
  'catalog',
  true,
  8388608,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set public = true;

drop policy if exists catalog_images_read on storage.objects;
create policy catalog_images_read
  on storage.objects
  for select
  using (bucket_id = 'catalog');
