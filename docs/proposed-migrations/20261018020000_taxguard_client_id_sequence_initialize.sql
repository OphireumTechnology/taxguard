-- PROPOSAL (Phase 14, client identity). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires the core schema (taxguard_client_id_sequence, taxguard_clients, taxguard_members,
-- taxguard_identities) and proposal 20261012060000 (atomic client identity).
--
-- taxguard_provision_client_identity deliberately refuses to allocate a client ID when the 'primary'
-- counter row is missing (CLIENT_COUNTER_CORRUPT): recreating a lost counter inside the function could
-- restart numbering. But no migration ever created that row, so on a freshly migrated database the first
-- self-registered client was refused and the portal reported the identity store as unavailable
-- (found by the Phase 14 journey B browser test; unit fixtures inserted the row by hand).
-- This proposal creates the row once, at migration time, and only ever moves the counter forward to the
-- highest numeric client ID already issued (3-9 digits), so no existing ID is reissued. The function's
-- fail-closed behaviour for a row that later goes missing or corrupt is unchanged. Alphabetic-range IDs
-- (issued only after 999,999,999 clients) are not inspected; the function's collision check still refuses
-- any duplicate. Re-running is harmless.
-- Rollback (development): none required; the row is the counter the function already expects.

INSERT INTO public.taxguard_client_id_sequence(id, current_sequence, last_issued_client_id)
  VALUES ('primary', 0, NULL)
  ON CONFLICT (id) DO NOTHING;

WITH issued AS (
  SELECT client_id::bigint AS n FROM public.taxguard_clients WHERE client_id ~ '^[0-9]{3,9}$'
  UNION ALL SELECT client_id::bigint FROM public.taxguard_members WHERE client_id ~ '^[0-9]{3,9}$'
  UNION ALL SELECT (user_data->>'clientId')::bigint FROM public.taxguard_identities WHERE user_data->>'clientId' ~ '^[0-9]{3,9}$'
)
UPDATE public.taxguard_client_id_sequence s
   SET current_sequence = (SELECT max(n) FROM issued), updated_at = now()
 WHERE s.id = 'primary'
   AND s.current_sequence >= 0
   AND (SELECT max(n) FROM issued) > s.current_sequence;
