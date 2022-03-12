-- Could not auto-generate a down migration.
-- Please write an appropriate down migration for the SQL below:
-- CREATE OR REPLACE VIEW "schedule"."OverlappingEvents" AS
-- SELECT rowa."conferenceId",
--     rowa.id AS "xId",
--     rowb.id AS "yId",
--     rowa."subconferenceId"
-- FROM schedule."Event" rowa
-- JOIN schedule."Event" rowb
-- ON (rowa."roomId" = rowb."roomId")
-- AND (
--     (rowa."sessionEventId" IS NOT NULL AND rowb."sessionEventId" IS NOT NULL AND rowa."sessionEventId" = rowb."sessionEventId")
--     OR (rowa."sessionEventId" IS NULL AND rowb."sessionEventId" IS NULL)
-- )
-- AND (rowa.id <> rowb.id)
-- AND (rowa."scheduledStartTime" < rowb."scheduledEndTime")
-- AND (rowa."scheduledEndTime" > rowb."scheduledStartTime")
-- ;
