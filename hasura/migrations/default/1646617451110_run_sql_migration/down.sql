-- Could not auto-generate a down migration.
-- Please write an appropriate down migration for the SQL below:
-- CREATE OR REPLACE FUNCTION room."IsStreamingProgramRoom"(i_row room."Room")
--  RETURNS boolean
--  LANGUAGE sql
--  STABLE
-- AS $function$
--     SELECT EXISTS (
--         SELECT 1
--         FROM "schedule"."Event" as event
--         WHERE event."roomId" = i_row."id"
--         AND event."intendedRoomModeName" = ANY('{"PRERECORDED", "PRESENTATION", "Q_AND_A"}')
--     )
-- $function$;
