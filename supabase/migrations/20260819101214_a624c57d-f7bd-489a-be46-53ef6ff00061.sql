update public.profiles p set name = v.n
from (values ('LU8MDR','Simon'),('9C4TJQ','Oliver'),('3JM9PV','Lukas'),('2V9PD3','Mads'),('V4FPPL','Mikko'),('ZKJ87Y','Javier'),('H74Z95','Hugo')) as v(code,n)
join public.family_circles fc on fc.family_code = v.code
join public.family_members fm on fm.family_circle_id = fc.id and fm.role = 'owner'
where p.id = fm.user_id and coalesce(p.name,'') = '';