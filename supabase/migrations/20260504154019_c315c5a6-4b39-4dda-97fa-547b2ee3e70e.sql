
DO $$
DECLARE
  me uuid := '2038651a-aaa5-4664-a7d6-e1fcbd146158';
  u1 uuid := '11111111-1111-1111-1111-111111111111';
  u2 uuid := '22222222-2222-2222-2222-222222222222';
  u3 uuid := '33333333-3333-3333-3333-333333333333';
  u4 uuid := '44444444-4444-4444-4444-444444444444';
  u5 uuid := '55555555-5555-5555-5555-555555555555';
  u6 uuid := '66666666-6666-6666-6666-666666666666';
  c1 uuid; c2 uuid; c3 uuid; c4 uuid;
  p1 uuid; p2 uuid; p3 uuid;
  conv1 uuid; conv2 uuid;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amelia.demo@peerly.app', crypt('demo-password', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Amelia Chen"}', false, false),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'noah.demo@peerly.app',   crypt('demo-password', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Noah Patel"}', false, false),
    (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sofia.demo@peerly.app',  crypt('demo-password', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sofia Garcia"}', false, false),
    (u4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'liam.demo@peerly.app',   crypt('demo-password', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Liam Okafor"}', false, false),
    (u5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mei.demo@peerly.app',    crypt('demo-password', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mei Tanaka"}', false, false),
    (u6, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'omar.demo@peerly.app',   crypt('demo-password', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Omar Haddad"}', false, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, full_name, username, avatar_url, university, country, field_of_study, year_of_study, bio, is_pro, is_verified, reputation_score, skills, interests)
  VALUES
    (u1, 'Amelia Chen',  'amelia_chen',  'https://i.pravatar.cc/200?img=47', 'Stanford University',     'USA',     'Computer Science',       3, 'CS junior into ML and design systems.',                            true,  true,  820, ARRAY['Python','React','TensorFlow'],   ARRAY['ML','Design']),
    (u2, 'Noah Patel',   'noah_patel',   'https://i.pravatar.cc/200?img=12', 'MIT',                     'USA',     'Electrical Engineering', 4, 'Hardware + embedded. Robotics club lead.',                          false, true,  610, ARRAY['C++','Arduino','MATLAB'],        ARRAY['Robotics']),
    (u3, 'Sofia Garcia', 'sofia_garcia', 'https://i.pravatar.cc/200?img=32', 'Universidad de Madrid',   'Spain',   'Mathematics',            2, 'Math nerd that loves tutoring stats.',                              true,  false, 540, ARRAY['Statistics','LaTeX','R'],        ARRAY['Tutoring']),
    (u4, 'Liam Okafor',  'liam_okafor',  'https://i.pravatar.cc/200?img=15', 'University of Lagos',     'Nigeria', 'Business',               3, 'Building a campus startup.',                                        false, false, 320, ARRAY['Marketing','Notion','Figma'],    ARRAY['Startups']),
    (u5, 'Mei Tanaka',   'mei_tanaka',   'https://i.pravatar.cc/200?img=20', 'University of Tokyo',     'Japan',   'Biology',                4, 'Biotech research assistant.',                                       true,  true,  710, ARRAY['Lab','Python','BioInformatics'], ARRAY['Research']),
    (u6, 'Omar Haddad',  'omar_haddad',  'https://i.pravatar.cc/200?img=68', 'AUC Cairo',               'Egypt',   'Architecture',           5, '3D modeler. Final-year thesis on sustainable housing.',             false, true,  480, ARRAY['Rhino','Revit','SketchUp'],      ARRAY['Architecture'])
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name, avatar_url = EXCLUDED.avatar_url,
    university = EXCLUDED.university, country = EXCLUDED.country,
    field_of_study = EXCLUDED.field_of_study, year_of_study = EXCLUDED.year_of_study,
    bio = EXCLUDED.bio, is_pro = EXCLUDED.is_pro, is_verified = EXCLUDED.is_verified,
    reputation_score = EXCLUDED.reputation_score,
    skills = EXCLUDED.skills, interests = EXCLUDED.interests;

  UPDATE public.profiles SET
    full_name = COALESCE(NULLIF(full_name,''), 'Mondiafere Ola'),
    university = COALESCE(university, 'Peerly University'),
    country = COALESCE(country, 'Global'),
    field_of_study = COALESCE(field_of_study, 'Computer Science'),
    year_of_study = COALESCE(year_of_study, 3),
    bio = COALESCE(NULLIF(bio,''), 'Founder of Peerly. Building the campus for the world.'),
    is_pro = true, is_verified = true,
    reputation_score = GREATEST(reputation_score, 950),
    skills = CASE WHEN array_length(skills,1) IS NULL THEN ARRAY['Product','React','Postgres'] ELSE skills END,
    interests = CASE WHEN array_length(interests,1) IS NULL THEN ARRAY['Startups','Music'] ELSE interests END,
    avatar_url = COALESCE(avatar_url, 'https://i.pravatar.cc/200?img=5')
  WHERE id = me;

  INSERT INTO public.circles (name, subject, description, leader_id, scope, is_premium, price_monthly, meeting_schedule, cover_color)
  VALUES ('ML Study Sprint', 'Computer Science', 'Weekly Kaggle-style ML challenges and paper reviews.', u1, 'global', false, NULL, 'Wednesdays 7pm UTC', '#6366f1') RETURNING id INTO c1;
  INSERT INTO public.circles (name, subject, description, leader_id, scope, is_premium, price_monthly, meeting_schedule, cover_color)
  VALUES ('Calculus Crew', 'Mathematics', 'Tackling Calc II/III problems together every Sunday.', u3, 'global', false, NULL, 'Sundays 4pm CET', '#10b981') RETURNING id INTO c2;
  INSERT INTO public.circles (name, subject, description, leader_id, scope, is_premium, price_monthly, meeting_schedule, cover_color)
  VALUES ('FAANG Interview Prep', 'Career', 'Mock interviews + system design. Pro-only.', u1, 'global', true, 9.99, 'Tue & Thu 9pm UTC', '#f59e0b') RETURNING id INTO c3;
  INSERT INTO public.circles (name, subject, description, leader_id, scope, is_premium, price_monthly, meeting_schedule, cover_color)
  VALUES ('Founders Lounge', 'Entrepreneurship', 'Student founders sharing wins, asks, and intros.', u4, 'global', false, NULL, 'Fridays 6pm WAT', '#ec4899') RETURNING id INTO c4;

  INSERT INTO public.circle_members (circle_id, user_id, role) VALUES
    (c1, me, 'member'), (c1, u2, 'member'), (c1, u5, 'member'),
    (c2, me, 'member'), (c2, u2, 'member'),
    (c4, me, 'member'), (c4, u6, 'member'), (c4, u3, 'member')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.circle_posts (circle_id, user_id, content) VALUES
    (c1, u1, 'Welcome! Drop your fav ML paper of 2025 👇'),
    (c1, u2, 'Loved the Mamba follow-up. Anyone want to recreate the benchmarks?'),
    (c2, u3, 'Sunday session: integration by parts marathon. Bring snacks.'),
    (c4, u4, 'Pitch night next Friday. Sign up in the doc.');

  INSERT INTO public.projects (creator_id, name, description, subject, category, open_roles, team_size_limit, is_public, progress, cover_color)
  VALUES (u1, 'StudyBuddy AI', 'An AI tutor that adapts to your learning style.', 'Computer Science', 'startup', ARRAY['designer','coder']::project_role[], 6, true, 35, '#6366f1') RETURNING id INTO p1;
  INSERT INTO public.projects (creator_id, name, description, subject, category, open_roles, team_size_limit, is_public, progress, cover_color)
  VALUES (u4, 'CampusMart', 'Marketplace for students to buy/sell textbooks and gear.', 'Business', 'startup', ARRAY['creator','coder']::project_role[], 5, true, 60, '#ec4899') RETURNING id INTO p2;
  INSERT INTO public.projects (creator_id, name, description, subject, category, open_roles, team_size_limit, is_public, progress, cover_color)
  VALUES (u5, 'EcoLab', 'Open dataset on campus carbon footprints across 50 unis.', 'Biology', 'research', ARRAY['researcher','writer']::project_role[], 4, true, 20, '#10b981') RETURNING id INTO p3;

  INSERT INTO public.project_members (project_id, user_id, role) VALUES
    (p1, me, 'coder'), (p1, u2, 'coder'), (p1, u6, 'designer'),
    (p2, me, 'creator'), (p2, u3, 'coder'),
    (p3, u1, 'researcher')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.project_tasks (project_id, user_id, assignee_id, title, description, status, position) VALUES
    (p1, u1, me,  'Design onboarding flow',    'Wireframes for first-run experience',    'in_progress', 1),
    (p1, u1, u2,  'Set up Postgres schema',    'Tables for sessions, lessons, progress', 'todo',        2),
    (p1, u1, u6,  'Pick brand palette',        'Light + dark tokens, semantic vars',     'done',        0),
    (p2, u4, me,  'Launch marketing landing',  'Hero + waitlist + 3 testimonials',       'in_progress', 1),
    (p2, u4, u3,  'Stripe Connect onboarding', 'Sellers get paid out weekly',            'todo',        2),
    (p3, u5, u1,  'Pull baseline campus data', 'Top 50 unis sustainability reports',     'in_progress', 1);

  INSERT INTO public.project_activity (project_id, user_id, content) VALUES
    (p1, u1, 'Kicked off the project ✨'),
    (p1, me, 'Joined as engineer. Excited to build!'),
    (p2, u4, 'Launching MVP next month'),
    (p3, u5, 'Reached out to sustainability office at MIT');

  INSERT INTO public.friend_requests (sender_id, recipient_id, status) VALUES
    (me, u1, 'accepted'),
    (u2, me, 'accepted'),
    (me, u3, 'accepted'),
    (u4, me, 'accepted'),
    (u5, me, 'pending'),
    (me, u6, 'pending');

  INSERT INTO public.conversations (user_a, user_b)
  VALUES (LEAST(me,u1), GREATEST(me,u1)) RETURNING id INTO conv1;
  INSERT INTO public.conversations (user_a, user_b)
  VALUES (LEAST(me,u2), GREATEST(me,u2)) RETURNING id INTO conv2;

  INSERT INTO public.messages (conversation_id, sender_id, content, created_at) VALUES
    (conv1, u1, 'Hey! Saw you joined the ML circle 🎉',                    now() - interval '2 hours'),
    (conv1, me, 'Yes! Excited to dive in. What track are you focused on?', now() - interval '1 hour 50 minutes'),
    (conv1, u1, 'Currently doing diffusion + a side project on RAG.',      now() - interval '1 hour 30 minutes'),
    (conv1, me, 'Nice. Want to pair this Sunday on the Kaggle challenge?', now() - interval '1 hour'),
    (conv1, u1, 'Deal. Send me a calendar invite 🚀',                      now() - interval '50 minutes'),
    (conv2, u2, 'Yo, the Postgres task on StudyBuddy — I can take it.',    now() - interval '40 minutes'),
    (conv2, me, 'Amazing. Ill move it to you in the kanban.',              now() - interval '30 minutes'),
    (conv2, u2, 'Sweet. Will push a draft schema tonight.',                now() - interval '5 minutes');

  INSERT INTO public.follows (follower_id, following_id) VALUES
    (me, u1), (me, u5),
    (u1, me), (u3, me), (u4, me)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.match_dismissals (user_id, dismissed_id) VALUES (me, u6)
  ON CONFLICT DO NOTHING;
END $$;
