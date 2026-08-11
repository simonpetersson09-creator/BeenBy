ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS geofence_enabled boolean NOT NULL DEFAULT false;