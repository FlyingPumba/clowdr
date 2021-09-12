CREATE OR REPLACE FUNCTION schedule."searchEvents"(search text, "conferenceId" uuid)
 RETURNS SETOF schedule."Event"
 LANGUAGE sql
 STABLE
AS $$
SELECT
  *
FROM
  "schedule"."Event"
WHERE
  (
    search <% ("name")
    -- Search event people
    OR (
        (SELECT COUNT(*) FROM "schedule"."EventProgramPerson"
        INNER JOIN "collection"."ProgramPerson"
        ON "schedule"."EventProgramPerson"."eventId" = "schedule"."Event"."id"
        AND "collection"."ProgramPerson"."id" = "schedule"."EventProgramPerson"."personId"
        AND (search <% "collection"."ProgramPerson"."name" OR search <% "collection"."ProgramPerson"."affiliation"))
        > 0
    )

    -- Search item
    OR (
        (NOT ("schedule"."Event"."itemId" IS NULL))
        AND "content"."searchItem"(search, "schedule"."Event"."itemId")
    )
    -- Search exhibition / items
    OR (
        (NOT ("schedule"."Event"."exhibitionId" IS NULL))
        AND 
            (SELECT COUNT(*) FROM "collection"."Exhibition"
            WHERE "collection"."Exhibition"."id" = "schedule"."Event"."exhibitionId"
            AND (
                search <% ("collection"."Exhibition"."name"))
                OR (SELECT COUNT(*) from "content"."ItemExhibition"
                    WHERE "content"."ItemExhibition"."exhibitionId" = "collection"."Exhibition"."id"
                    AND "content"."searchItem"(search, "content"."ItemExhibition"."itemId"))
                   > 0
            )
            > 0
    )
  )
  AND "schedule"."Event"."conferenceId" = "conferenceId"
ORDER BY
  similarity(search, ("name")) DESC;
$$;
