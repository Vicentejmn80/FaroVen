-- Permite que el coordinador rechace una solicitud logística ("No dispongo").
-- Antes el CHECK solo aceptaba brigade | delivery | needs_volunteer, por eso el botón fallaba.

ALTER TABLE public.inventory_reservations
  DROP CONSTRAINT IF EXISTS inventory_reservations_resolution_mode_check;

ALTER TABLE public.inventory_reservations
  ADD CONSTRAINT inventory_reservations_resolution_mode_check
  CHECK (
    resolution_mode IS NULL
    OR resolution_mode IN ('brigade', 'delivery', 'needs_volunteer', 'declined')
  );
