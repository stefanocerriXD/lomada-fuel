-- Rediseño: ejecutar UNA vez en el SQL Editor de Supabase, después de schema.sql.

-- Perfil personalizable desde Ajustes.
alter table public.perfiles
  add column if not exists emoji text not null default '🍽️',
  add column if not exists color text not null default '#E4572E',
  add column if not exists meta_calorias integer not null default 2000
    check (meta_calorias between 800 and 6000);

-- Detalle de lo que tiene cada comida (alimento, gramos y macros).
alter table public.comidas
  add column if not exists alimentos jsonb not null default '[]'::jsonb;

-- El muro y el resumen se actualizan en vivo cuando alguien sube una comida.
alter publication supabase_realtime add table public.comidas;
