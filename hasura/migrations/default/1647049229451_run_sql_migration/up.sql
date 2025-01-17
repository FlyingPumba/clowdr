CREATE OR REPLACE FUNCTION schedule."checkInsertEvent"()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF (NEW."modeName" = 'LIVESTREAM') THEN
        IF NOT (SELECT "areStreamingEventsAllowed" FROM "conference"."Quota" as quota WHERE quota."conferenceId" = NEW."conferenceId") THEN
            RAISE EXCEPTION 'Quota limit reached (streaming events not included)';
        END IF;

        IF (SELECT "maxStreamingEventIndividualMinutes" FROM "conference"."Quota" as quota WHERE quota."conferenceId" = NEW."conferenceId") * 60 < 
			EXTRACT(EPOCH FROM NEW."scheduledEndTime" - NEW."scheduledStartTime")
		THEN
            RAISE EXCEPTION 'Quota limit reached (streaming event duration)';
        END IF;
        
        IF (SELECT "remainingStreamingEventTotalMinutes" FROM "conference"."RemainingQuota" as remQuota WHERE remQuota."conferenceId" = NEW."conferenceId") * 60 < 
		   EXTRACT(EPOCH FROM NEW."scheduledEndTime" - NEW."scheduledStartTime")
		THEN
            RAISE EXCEPTION 'Quota limit reached (total streaming event minutes)';
        END IF;
        
        -- Rooms are either streaming rooms or non-streaming rooms
        IF (EXISTS (
                SELECT 1
                FROM "schedule"."Event" as event1
                WHERE event1."roomId" = NEW."roomId"
                AND NOT (event1."modeName" = 'LIVESTREAM')
            )) THEN
            RAISE EXCEPTION 'Room is a non-streaming program room.';
        END IF;
        
        IF (
            -- Not already a program room
            NOT EXISTS (
                SELECT 1
                FROM "schedule"."Event" as event1
                WHERE event1."roomId" = NEW."roomId"
            )
            -- And streaming program room quota limit reached
            AND (SELECT "remainingStreamingProgramRooms" FROM "conference"."RemainingQuota" as remQuota WHERE remQuota."conferenceId" = NEW."conferenceId") <= 0
        )
        THEN
            RAISE EXCEPTION 'Quota limit reached (streaming program rooms)';
        END IF;
    ELSEIF (NEW."modeName" = 'VIDEO_CHAT') THEN
        IF NOT (SELECT "areVideoChatEventsAllowed" FROM "conference"."Quota" as quota WHERE quota."conferenceId" = NEW."conferenceId") THEN
            RAISE EXCEPTION 'Quota limit reached (video-chat events not included)';
        END IF;

        IF (SELECT "maxVideoChatEventIndividualMinutes" FROM "conference"."Quota" as quota WHERE quota."conferenceId" = NEW."conferenceId") * 60 < 
		   EXTRACT(EPOCH FROM NEW."scheduledEndTime" - NEW."scheduledStartTime")
		THEN
            RAISE EXCEPTION 'Quota limit reached (video-chat event duration)';
        END IF;
        
        IF (SELECT "remainingVideoChatEventTotalMinutes" FROM "conference"."RemainingQuota" as remQuota WHERE remQuota."conferenceId" = NEW."conferenceId") * 60 < 
		   EXTRACT(EPOCH FROM NEW."scheduledEndTime" - NEW."scheduledStartTime")
		THEN
            RAISE EXCEPTION 'Quota limit reached (total video-chat event minutes)';
        END IF;
        
        -- Rooms are either streaming rooms or non-streaming rooms
        IF (EXISTS (
                SELECT 1
                FROM "schedule"."Event" as event1
                WHERE event1."roomId" = NEW."roomId"
                AND event1."modeName" = 'LIVESTREAM'
            )) THEN
            RAISE EXCEPTION 'Room is a streaming program room.';
        END IF;
        
        IF (
            -- Not already a program room
            NOT EXISTS (
                SELECT 1
                FROM "schedule"."Event" as event1
                WHERE event1."roomId" = NEW."roomId"
            )
            -- And non-streaming program room quota limit reached
            AND (SELECT "remainingNonStreamingProgramRooms" FROM "conference"."RemainingQuota" as remQuota WHERE remQuota."conferenceId" = NEW."conferenceId") <= 0
        )
        THEN
            RAISE EXCEPTION 'Quota limit reached (non-streaming program rooms)';
        END IF;
    ELSE
        -- Rooms are either streaming rooms or non-streaming rooms
        IF (EXISTS (
                SELECT 1
                FROM "schedule"."Event" as event1
                WHERE event1."roomId" = NEW."roomId"
                AND event1."modeName" = 'LIVESTREAM'
            )) THEN
            RAISE EXCEPTION 'Room is a streaming program room.';
        END IF;
        
        IF (
            -- Not already a program room
            NOT EXISTS (
                SELECT 1
                FROM "schedule"."Event" as event1
                WHERE event1."roomId" = NEW."roomId"
            )
            -- And non-streaming program room quota limit reached
            AND (SELECT "remainingNonStreamingProgramRooms" FROM "conference"."RemainingQuota" as remQuota WHERE remQuota."conferenceId" = NEW."conferenceId") <= 0
        )
        THEN
            RAISE EXCEPTION 'Quota limit reached (non-streaming program rooms)';
        END IF;
    END IF;

    RETURN NEW;
END
$function$;
