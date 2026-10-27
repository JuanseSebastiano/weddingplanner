-- Atajo de Apple Pay ------------------------------------------------------
-- La automatización de Wallet de iOS (Atajos) manda cada pago sin contacto
-- a /api/fin/atajo/gasto. No hay sesión: la autentica este token, uno por
-- integrante, que solo ve su dueño en Finanzas → Configuración.
alter table couple_members add column shortcut_token uuid not null default gen_random_uuid() unique;

alter type expense_source add value if not exists 'shortcut';
