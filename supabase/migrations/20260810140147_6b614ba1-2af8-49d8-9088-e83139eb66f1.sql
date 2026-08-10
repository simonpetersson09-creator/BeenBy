delete from public.family_members m using public.profiles p where m.user_id = p.id and p.name = 'Testis';
delete from public.profiles where name = 'Testis';