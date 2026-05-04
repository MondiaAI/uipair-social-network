
-- Enums
CREATE TYPE public.gig_category AS ENUM ('tutoring','notes','research','coding','design','translation','proofreading','other');
CREATE TYPE public.gig_order_status AS ENUM ('pending','in_progress','delivered','completed','cancelled','refunded');
CREATE TYPE public.bounty_status AS ENUM ('open','claimed','completed','cancelled');

-- Gigs
CREATE TABLE public.gigs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  title text NOT NULL,
  category public.gig_category NOT NULL DEFAULT 'tutoring',
  description text,
  included_items text[] NOT NULL DEFAULT '{}',
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  delivery_days integer NOT NULL DEFAULT 3,
  requires_file_upload boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gigs viewable by authenticated" ON public.gigs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create gigs" ON public.gigs FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers update own gigs" ON public.gigs FOR UPDATE TO authenticated USING (auth.uid() = seller_id);
CREATE POLICY "Sellers delete own gigs" ON public.gigs FOR DELETE TO authenticated USING (auth.uid() = seller_id);
CREATE TRIGGER set_gigs_updated_at BEFORE UPDATE ON public.gigs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Gig orders
CREATE TABLE public.gig_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status public.gig_order_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gig_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order parties can view" ON public.gig_orders FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Buyers create orders" ON public.gig_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Order parties update" ON public.gig_orders FOR UPDATE TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE TRIGGER set_gig_orders_updated_at BEFORE UPDATE ON public.gig_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bounties
CREATE TABLE public.bounties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id uuid NOT NULL,
  claimer_id uuid,
  title text NOT NULL,
  description text,
  subject text NOT NULL,
  reward_cents integer NOT NULL CHECK (reward_cents >= 0),
  status public.bounty_status NOT NULL DEFAULT 'open',
  deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bounties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bounties viewable by authenticated" ON public.bounties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create bounties" ON public.bounties FOR INSERT TO authenticated WITH CHECK (auth.uid() = poster_id);
CREATE POLICY "Poster or claimer update" ON public.bounties FOR UPDATE TO authenticated USING (auth.uid() = poster_id OR auth.uid() = claimer_id OR (status = 'open'));
CREATE POLICY "Poster delete" ON public.bounties FOR DELETE TO authenticated USING (auth.uid() = poster_id);
CREATE TRIGGER set_bounties_updated_at BEFORE UPDATE ON public.bounties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Resources
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  subject text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  file_url text,
  preview_url text,
  download_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Resources viewable by authenticated" ON public.resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create resources" ON public.resources FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "Uploader update" ON public.resources FOR UPDATE TO authenticated USING (auth.uid() = uploader_id);
CREATE POLICY "Uploader delete" ON public.resources FOR DELETE TO authenticated USING (auth.uid() = uploader_id);
CREATE TRIGGER set_resources_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Resource purchases
CREATE TABLE public.resource_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, buyer_id)
);

ALTER TABLE public.resource_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Purchase parties view" ON public.resource_purchases FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Buyers create purchases" ON public.resource_purchases FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);

CREATE INDEX idx_gigs_seller ON public.gigs(seller_id);
CREATE INDEX idx_gigs_category ON public.gigs(category);
CREATE INDEX idx_gig_orders_buyer ON public.gig_orders(buyer_id);
CREATE INDEX idx_gig_orders_seller ON public.gig_orders(seller_id);
CREATE INDEX idx_bounties_status ON public.bounties(status);
CREATE INDEX idx_resources_uploader ON public.resources(uploader_id);
