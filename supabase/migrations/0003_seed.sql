-- Seed inicial: la boda y los dos usuarios habilitados.
insert into weddings (id, fecha, lugar, presupuesto_objetivo, moneda_base, cotizacion_referencia)
values (
  '11111111-1111-1111-1111-111111111111',
  '2027-04-02',
  'Solís, Provincia de Buenos Aires',
  10000,
  'USD',
  1400
)
on conflict (id) do nothing;

insert into wedding_members (wedding_id, email, nombre, rol)
values
  ('11111111-1111-1111-1111-111111111111', 'jssebastiano@gmail.com', 'Juanse', 'novio'),
  ('11111111-1111-1111-1111-111111111111', 'sofia.fiorda@santodomingo.com.ar', 'Sofía', 'novia')
on conflict (email) do nothing;
