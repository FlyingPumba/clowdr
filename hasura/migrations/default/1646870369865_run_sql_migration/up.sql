CREATE OR REPLACE VIEW "conference"."RemainingQuota" AS 
 SELECT conf.id AS "conferenceId",
    conf.slug,
    (quota."maxSubconferences" - ( SELECT count(*) AS count
           FROM conference."Subconference" subconf
          WHERE (subconf."conferenceId" = conf.id))) AS "remainingSubconferences",
    ((quota."maxStreamingEventTotalMinutes" - usage."consumedStreamingEventTotalMinutes") - COALESCE(( SELECT (round(((sum(GREATEST(0, LEAST(event4."durationSeconds", (((event4."durationSeconds")::double precision + date_part('epoch'::text, (event4."startTime" - now()))))::integer))) / 60))::double precision))::integer AS round
           FROM schedule."Event" event4
          WHERE ((event4."conferenceId" = conf.id) AND (event4."intendedRoomModeName" = ANY ('{PRERECORDED,PRESENTATION,Q_AND_A}'::text[])))), 0)) AS "remainingStreamingEventTotalMinutes",
    ((quota."maxVideoChatEventTotalMinutes" - usage."consumedVideoChatEventTotalMinutes") - COALESCE(( SELECT (round(((sum(GREATEST(0, LEAST(event4."durationSeconds", (((event4."durationSeconds")::double precision + date_part('epoch'::text, (event4."startTime" - now()))))::integer))) / 60))::double precision))::integer AS round
           FROM schedule."Event" event4
          WHERE ((event4."conferenceId" = conf.id) AND (event4."intendedRoomModeName" = 'VIDEO_CHAT'::text))), 0)) AS "remainingVideoChatEventTotalMinutes",
    (quota."maxRegistrants" - ( SELECT count(*) AS count
           FROM registrant."Registrant" subconf
          WHERE (subconf."conferenceId" = conf.id))) AS "remainingRegistrants",
    (quota."maxVideoChatNonEventTotalMinutesConsumed" - usage."consumedVideoChatNonEventTotalMinutes") AS "remainingVideoChatNonEventTotalMinutes",
    (quota."maxSupportMeetingMinutes" - usage."consumedSupportMeetingMinutes") AS "remainingSupportMeetingMinutes",
    (quota."maxStreamingProgramRooms" - ( SELECT count(*) AS count
           FROM room."Room" room1
          WHERE ((room1."conferenceId" = conf.id) AND (EXISTS ( SELECT 1
                   FROM schedule."Event" event1
                  WHERE ((event1."roomId" = room1.id) AND (event1."intendedRoomModeName" = ANY ('{PRERECORDED,PRESENTATION,Q_AND_A}'::text[])))))))) AS "remainingStreamingProgramRooms",
    (quota."maxNonStreamingProgramRooms" - ( SELECT count(*) AS count
           FROM room."Room" room2
          WHERE ((room2."conferenceId" = conf.id) AND (EXISTS ( SELECT 1
                   FROM schedule."Event" event2
                  WHERE ((event2."roomId" = room2.id) AND (NOT (event2."intendedRoomModeName" = ANY ('{PRERECORDED,PRESENTATION,Q_AND_A}'::text[]))))))))) AS "remainingNonStreamingProgramRooms",
    (quota."maxPublicSocialRooms" - ( SELECT count(*) AS count
           FROM room."Room" room3
          WHERE ((room3."conferenceId" = conf.id) AND (room3."managementModeName" = 'PUBLIC'::text) AND (room3."itemId" IS NULL) AND (NOT (EXISTS ( SELECT 1
                   FROM schedule."Event" event3
                  WHERE (event3."roomId" = room3.id))))))) AS "remainingPublicSocialRooms",
    (quota."maxContentItems" - ( SELECT count(*) AS count
           FROM content."Item" item1
          WHERE (item1."conferenceId" = conf.id AND item1."typeName" != 'SPONSOR'))) AS "remainingContentItems"
   FROM ((conference."Conference" conf
     LEFT JOIN conference."Quota" quota ON ((quota."conferenceId" = conf.id)))
     LEFT JOIN conference."Usage" usage ON ((usage."conferenceId" = conf.id)));
