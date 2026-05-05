
-- Set price for the Pro premium circle that's missing one
UPDATE public.circles SET price_monthly = 14.99 WHERE id = '4111a512-f01c-44b2-b75e-2d124f96e523' AND price_monthly IS NULL;

-- Seed posts across circles (idempotent via unique content+circle check)
INSERT INTO public.circle_posts (circle_id, user_id, content, created_at)
SELECT * FROM (VALUES
  ('d64b7fba-38f8-4b52-8d1f-8a5007d345db'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, 'Kicking off Week 3 — focus is gradient boosting. Drop your blockers below 👇', now() - interval '2 days'),
  ('d64b7fba-38f8-4b52-8d1f-8a5007d345db'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Anyone want to pair on the XGBoost notebook tonight? I''m stuck on hyperparameter tuning.', now() - interval '1 day'),
  ('d64b7fba-38f8-4b52-8d1f-8a5007d345db'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Sharing my notes from the Andrew Ng lecture — see resources tab.', now() - interval '6 hours'),
  ('f9f8840f-10c5-4d83-869d-15bc62a41a92'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Practice problem: integrate (sin x)^3 cos x dx. Post your approach!', now() - interval '3 days'),
  ('f9f8840f-10c5-4d83-869d-15bc62a41a92'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'Use u = sin x → answer is sin^4(x)/4 + C. Took me a sec 😅', now() - interval '2 days'),
  ('5d83947f-8ef1-4fdf-87b0-dc0490291a0e'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, 'Just shipped my landing page — feedback welcome. What converts for you all?', now() - interval '4 hours'),
  ('5d83947f-8ef1-4fdf-87b0-dc0490291a0e'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'Looking for a technical co-founder for an EdTech tool. DM me!', now() - interval '1 day'),
  ('372aa581-6841-4923-b1a0-1ae37cd1b4a7'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '[Premium] This week''s mock: system design for a URL shortener. Live session Saturday 4pm UTC.', now() - interval '12 hours'),
  ('617b081d-ef98-4ca3-bf6b-7ca9852b0ef3'::uuid, '2038651a-aaa5-4664-a7d6-e1fcbd146158'::uuid, 'CLRS Chapter 22 reading group starts Friday. Bring questions!', now() - interval '8 hours')
) AS v(circle_id, user_id, content, created_at)
WHERE NOT EXISTS (SELECT 1 FROM public.circle_posts cp WHERE cp.circle_id = v.circle_id AND cp.content = v.content);

-- Seed resources
INSERT INTO public.circle_resources (circle_id, user_id, title, url, resource_type, created_at)
SELECT * FROM (VALUES
  ('d64b7fba-38f8-4b52-8d1f-8a5007d345db'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, 'Hands-On ML — Chapter 7 (Ensemble Learning)', 'https://github.com/ageron/handson-ml3', 'link', now() - interval '3 days'),
  ('d64b7fba-38f8-4b52-8d1f-8a5007d345db'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Andrew Ng — Boosting Lecture Notes (PDF)', 'https://cs229.stanford.edu/notes/cs229-notes6.pdf', 'link', now() - interval '6 hours'),
  ('f9f8840f-10c5-4d83-869d-15bc62a41a92'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Paul''s Online Math Notes — Integrals', 'https://tutorial.math.lamar.edu/classes/calci/integralsintro.aspx', 'link', now() - interval '2 days'),
  ('5d83947f-8ef1-4fdf-87b0-dc0490291a0e'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, 'YC Startup School — Free Course', 'https://www.startupschool.org/', 'link', now() - interval '5 hours'),
  ('372aa581-6841-4923-b1a0-1ae37cd1b4a7'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'System Design Primer', 'https://github.com/donnemartin/system-design-primer', 'link', now() - interval '10 hours'),
  ('617b081d-ef98-4ca3-bf6b-7ca9852b0ef3'::uuid, '2038651a-aaa5-4664-a7d6-e1fcbd146158'::uuid, 'CLRS — Introduction to Algorithms (3rd ed)', 'https://mitpress.mit.edu/9780262033848/introduction-to-algorithms/', 'link', now() - interval '8 hours')
) AS v(circle_id, user_id, title, url, resource_type, created_at)
WHERE NOT EXISTS (SELECT 1 FROM public.circle_resources cr WHERE cr.circle_id = v.circle_id AND cr.title = v.title);

-- Seed upcoming sessions
INSERT INTO public.circle_sessions (circle_id, user_id, title, description, scheduled_at, join_url, created_at)
SELECT * FROM (VALUES
  ('d64b7fba-38f8-4b52-8d1f-8a5007d345db'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, 'XGBoost Pair Programming', 'Work through the Kaggle notebook together', now() + interval '2 days', 'https://meet.google.com/abc-defg-hij', now()),
  ('d64b7fba-38f8-4b52-8d1f-8a5007d345db'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Weekly ML Q&A', 'Bring your blockers — open hour', now() + interval '5 days', 'https://meet.google.com/xyz-uvwt-rst', now()),
  ('f9f8840f-10c5-4d83-869d-15bc62a41a92'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Integration Techniques Drill', 'u-sub, by parts, partial fractions', now() + interval '3 days', 'https://meet.google.com/cal-cul-001', now()),
  ('5d83947f-8ef1-4fdf-87b0-dc0490291a0e'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, 'Founder Coffee Chat', 'Casual hangout — share what you''re building', now() + interval '1 day', 'https://meet.google.com/fnd-coff-001', now()),
  ('372aa581-6841-4923-b1a0-1ae37cd1b4a7'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Mock Interview: System Design', 'Live whiteboarding — URL shortener', now() + interval '4 days', 'https://meet.google.com/faa-ngsd-001', now()),
  ('617b081d-ef98-4ca3-bf6b-7ca9852b0ef3'::uuid, '2038651a-aaa5-4664-a7d6-e1fcbd146158'::uuid, 'CLRS Chapter 22 — Graphs', 'Reading group + problems', now() + interval '6 days', 'https://meet.google.com/clrs-22-grp', now())
) AS v(circle_id, user_id, title, description, scheduled_at, join_url, created_at)
WHERE NOT EXISTS (SELECT 1 FROM public.circle_sessions cs WHERE cs.circle_id = v.circle_id AND cs.title = v.title);
