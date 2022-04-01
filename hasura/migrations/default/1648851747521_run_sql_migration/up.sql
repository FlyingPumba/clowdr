CREATE OR REPLACE FUNCTION schedule."shiftTimes"("eventIds" uuid[], minutes integer)
 RETURNS SETOF schedule."Event"
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
        UPDATE
          "schedule"."Event" as event
        SET
          "scheduledStartTime" = event."scheduledStartTime" + (interval '1 minute' * minutes),
          "scheduledEndTime" = event."scheduledEndTime" + (interval '1 minute' * minutes)
        WHERE
          (event.id = ANY("eventIds") OR event."sessionEventId" = ANY("eventIds")) AND
          event."scheduledStartTime" IS NOT NULL AND
          event."scheduledEndTime" IS NOT NULL
        RETURNING event.*;

    RETURN;
END;
$function$;
