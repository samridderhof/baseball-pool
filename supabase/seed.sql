insert into public.leagues (name, invite_code, season_year)
values ('Saturday Slugfest', 'replace-with-real-invite-code', extract(year from now())::int)
on conflict (invite_code) do nothing;
