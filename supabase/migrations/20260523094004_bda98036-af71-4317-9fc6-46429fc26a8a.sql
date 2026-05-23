
do $$
declare
  t text;
  tables text[] := array[
    'posts','comments','reactions','follows','friend_requests','conversations','messages',
    'conversation_mutes','notifications','match_dismissals',
    'circles','circle_members','circle_posts','circle_post_comments',
    'circle_resources','circle_sessions','circle_announcements','circle_invites','circle_subscriptions',
    'projects','project_members','project_tasks','project_files','project_activity',
    'project_comments','project_applications','project_join_requests','project_workspaces',
    'gigs','gig_orders','gig_reviews','bounties',
    'resources','resource_purchases','study_requests',
    'hackathon_banners','ambassador_applications'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I alter column tenant_id set default public.current_tenant_id()', t);
  end loop;
end $$;
