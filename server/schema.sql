CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admins ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT 'Master Admin';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'master' CHECK (role IN ('master','staff'));
ALTER TABLE admins ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES admins(id) ON DELETE SET NULL;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  image_url TEXT NOT NULL,
  map_x NUMERIC(5,2) NOT NULL CHECK (map_x BETWEEN 0 AND 100),
  map_y NUMERIC(5,2) NOT NULL CHECK (map_y BETWEEN 0 AND 100),
  published BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days BETWEEN 1 AND 90),
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  image_url TEXT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  seats_reserved INTEGER NOT NULL DEFAULT 0 CHECK (seats_reserved >= 0 AND seats_reserved <= capacity),
  price_paise INTEGER CHECK (price_paise IS NULL OR price_paise >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
  UNIQUE(package_id, starts_on)
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  departure_id UUID NOT NULL REFERENCES departures(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  traveller_count INTEGER NOT NULL CHECK (traveller_count BETWEEN 1 AND 12),
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','expired')),
  payment_provider TEXT,
  payment_reference TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS travellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 1 AND 120),
  traveller_type TEXT NOT NULL DEFAULT 'adult' CHECK (traveller_type IN ('adult','child')),
  position INTEGER NOT NULL CHECK (position >= 0),
  UNIQUE(booking_id, position)
);

CREATE TABLE IF NOT EXISTS story_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_key TEXT NOT NULL UNIQUE,
  heading TEXT NOT NULL,
  subheading TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  primary_image TEXT,
  cta_text TEXT,
  cta_href TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  animation_preset TEXT NOT NULL DEFAULT 'MINIMAL' CHECK (animation_preset IN ('FADE','PARALLAX','IMAGE_REVEAL','ROUTE','PINNED','HORIZONTAL','MINIMAL')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE story_scenes ADD COLUMN IF NOT EXISTS secondary_image TEXT;
ALTER TABLE story_scenes ADD COLUMN IF NOT EXISTS background_video TEXT;
ALTER TABLE story_scenes ADD COLUMN IF NOT EXISTS linked_package_id UUID REFERENCES packages(id) ON DELETE SET NULL;
ALTER TABLE story_scenes ADD COLUMN IF NOT EXISTS linked_destination_id UUID REFERENCES destinations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID REFERENCES destinations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  traveller_name TEXT NOT NULL,
  destination TEXT NOT NULL,
  travelled_on DATE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  quote TEXT NOT NULL,
  image_url TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS review_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  media_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  original_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS departures_open_idx ON departures(package_id, starts_on) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS bookings_email_idx ON bookings(lower(customer_email), created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_departure_idx ON bookings(departure_id, status);
CREATE INDEX IF NOT EXISTS gallery_order_idx ON gallery_items(published, display_order);
CREATE INDEX IF NOT EXISTS reviews_moderation_idx ON reviews(published, created_at DESC);
CREATE INDEX IF NOT EXISTS review_media_review_idx ON review_media(review_id, display_order);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_log(created_at DESC);
