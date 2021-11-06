CREATE OR REPLACE FUNCTION registrant."InvitationEmailStatus"(i_row registrant."Registrant")
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    invite_id uuid;
BEGIN
  SELECT id INTO invite_id FROM "registrant"."Invitation" WHERE "registrantId" = i_row.id;
  
  IF (invite_id IS NOT NULL) THEN
    RETURN COALESCE((SELECT to_jsonb(rows) FROM (SELECT "sentAt", COALESCE("status", 'delivered') as status, "errorMessage" FROM "public"."Email" WHERE "invitationId" = invite_id and "reason" = 'invite' ORDER BY "created_at" DESC LIMIT 1) as rows), 'null'::jsonb);
  ELSE
    RETURN '{ "status": "delivered" }'::jsonb;
  END IF;
END;
$function$;
