CREATE OR REPLACE FUNCTION chat."canAccessChat"(i_registrantid uuid, i_chatid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    -- l_contentExists boolean;
    l_roomExists boolean;
    l_hasAccessToRoom boolean;
    l_matching_conferences boolean;
BEGIN
    -- l_contentExists := EXISTS (
    --    SELECT 1 FROM "content"."Item" 
    --    WHERE "content"."Item"."chatId" = i_chatId
    -- );
    
    l_roomExists := EXISTS (
        SELECT 1 FROM "room"."Room" 
        WHERE "room"."Room"."chatId" = i_chatId 
    );

    l_hasAccessToRoom := EXISTS (
        SELECT 1 FROM "room"."Room" 
        WHERE "room"."Room"."chatId" = i_chatId 
            AND ( "room"."Room"."managementModeName" = 'PUBLIC'
                    OR EXISTS (
                        SELECT 1 FROM "room"."RoomMembership" 
                            WHERE "room"."RoomMembership"."roomId" = "room"."Room"."id" 
                            AND "room"."RoomMembership"."registrantId" = i_registrantId
                        )
                    OR EXISTS (
                        SELECT 1 FROM "room"."RoomGroupMembership" 
                        JOIN "registrant"."GroupRegistrant"
                        ON "room"."RoomGroupMembership"."roomId" = "room"."Room"."id" 
                        AND "room"."RoomGroupMembership"."groupId" = "registrant"."GroupRegistrant"."groupId"
                        AND "registrant"."GroupRegistrant"."registrantId" = i_registrantId
                    )
                )
    );
    
    l_matching_conferences := (
        SELECT ("registrant"."Registrant"."conferenceId" = "chat"."Chat"."conferenceId")
        FROM "registrant"."Registrant"
        INNER JOIN "chat"."Chat"
        ON "registrant"."Registrant"."id" = i_registrantId
        AND "chat"."Chat"."id" = i_chatId
    );

    RETURN l_matching_conferences AND (l_hasAccessToRoom OR NOT l_roomExists);
    -- l_contentExists OR l_hasAccessToRoom OR NOT (l_contentExists AND l_roomExists);
END;
$function$;
