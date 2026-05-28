
DO $$
DECLARE
  demo RECORD;
  new_id uuid;
BEGIN
  FOR demo IN
    SELECT * FROM (VALUES
      ('amara@demo.uipair.com','Amara Okonkwo','amara_o','https://i.pravatar.cc/200?img=47','Massachusetts Institute of Technology','USA','Computer Science',3,'CS junior into ML and open-source. Always down for a late-night study session.','35eb8149-03d3-43a5-8322-c231e32de9ca'::uuid,ARRAY['Python','Machine Learning','React'],ARRAY['evenings','weekends'],'Land a research internship and ship a side project.','2003-04-12'::date),
      ('liam@demo.uipair.com','Liam Chen','liamc','https://i.pravatar.cc/200?img=12','Massachusetts Institute of Technology','USA','Electrical Engineering',4,'Senior EE, hardware + embedded systems nerd.','35eb8149-03d3-43a5-8322-c231e32de9ca'::uuid,ARRAY['C++','Embedded','PCB Design'],ARRAY['mornings','weekends'],'Graduate with honors and join a robotics startup.','2002-08-22'::date),
      ('sophia@demo.uipair.com','Sophia Müller','sophiam','https://i.pravatar.cc/200?img=32','National University of Singapore','Singapore','Data Science',2,'Stats-heavy data sci student. Love clean notebooks.','6dff3b42-0381-4a55-8297-263903246530'::uuid,ARRAY['R','Statistics','SQL'],ARRAY['evenings'],'Master ML theory and intern at a fintech.','2004-01-30'::date),
      ('kwame@demo.uipair.com','Kwame Mensah','kwame_m','https://i.pravatar.cc/200?img=68','University of Cape Town','South Africa','Mechanical Engineering',3,'MechE + entrepreneurship. Building a clean-energy side hustle.','729df180-7370-412e-bff3-92b1edb21cf2'::uuid,ARRAY['CAD','MATLAB','Project Management'],ARRAY['weekends','mornings'],'Win a hackathon and prototype my energy device.','2002-11-05'::date),
      ('aisha@demo.uipair.com','Aisha Uwase','aisha_u','https://i.pravatar.cc/200?img=45','University of Rwanda','Rwanda','Medicine',4,'Med student passionate about public health and research.','bd40e752-663c-42ff-836a-e84b0a1311d7'::uuid,ARRAY['Research','Biostatistics','Writing'],ARRAY['evenings','weekends'],'Publish my first paper before graduation.','2001-06-18'::date),
      ('noah@demo.uipair.com','Noah Patel','noahp','https://i.pravatar.cc/200?img=15','Makerere University','Uganda','Business Administration',2,'Aspiring product manager. I love spreadsheets way too much.','20758299-8419-49e1-9b47-b4986c08b4c9'::uuid,ARRAY['Excel','Marketing','Public Speaking'],ARRAY['mornings'],'Launch a student-run business this year.','2003-09-09'::date),
      ('zara@demo.uipair.com','Zara Ahmed','zara_a','https://i.pravatar.cc/200?img=49','Massachusetts Institute of Technology','USA','Mathematics',2,'Pure math + cryptography. Coffee-fueled proofs.','35eb8149-03d3-43a5-8322-c231e32de9ca'::uuid,ARRAY['LaTeX','Cryptography','Proofs'],ARRAY['evenings','weekends'],'Get into a top PhD program.','2004-02-14'::date),
      ('diego@demo.uipair.com','Diego Hernández','diegoh','https://i.pravatar.cc/200?img=8','University of Cape Town','South Africa','Architecture',3,'Designing sustainable spaces. Sketchbook always in bag.','729df180-7370-412e-bff3-92b1edb21cf2'::uuid,ARRAY['Rhino','SketchUp','Illustration'],ARRAY['weekends'],'Win a student design award.','2002-05-27'::date),
      ('mei@demo.uipair.com','Mei Tan','meit','https://i.pravatar.cc/200?img=20','National University of Singapore','Singapore','Law',4,'Final-year law. Mooting & legal tech enthusiast.','6dff3b42-0381-4a55-8297-263903246530'::uuid,ARRAY['Legal Research','Writing','Debate'],ARRAY['mornings','evenings'],'Secure a training contract at a top firm.','2001-12-03'::date),
      ('joseph@demo.uipair.com','Joseph Mugisha','josephm','https://i.pravatar.cc/200?img=11','Makerere University','Uganda','Computer Science',3,'Backend dev. Building tools for African students.','20758299-8419-49e1-9b47-b4986c08b4c9'::uuid,ARRAY['Node.js','Postgres','Go'],ARRAY['evenings','weekends'],'Ship an app used by 1k students.','2002-10-21'::date)
    ) AS t(email,full_name,username,avatar_url,university,country,field_of_study,year_of_study,bio,tenant_id,skills,availability,goals,dob)
  LOOP
    -- Skip if email already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = demo.email) THEN
      CONTINUE;
    END IF;

    new_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      new_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      demo.email, crypt('DemoPass123!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', demo.full_name, 'username', demo.username, 'avatar_url', demo.avatar_url),
      now(), now(), '', '', '', ''
    );

    -- handle_new_user trigger created a base profile row; now enrich it
    UPDATE public.profiles SET
      full_name = demo.full_name,
      username = demo.username,
      avatar_url = demo.avatar_url,
      university = demo.university,
      country = demo.country,
      field_of_study = demo.field_of_study,
      year_of_study = demo.year_of_study,
      bio = demo.bio,
      tenant_id = demo.tenant_id,
      skills = demo.skills,
      availability = demo.availability,
      goals = demo.goals,
      date_of_birth = demo.dob,
      terms_accepted_at = now(),
      onboarding_completed = true
    WHERE id = new_id;
  END LOOP;
END $$;
