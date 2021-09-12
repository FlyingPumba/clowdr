CREATE OR REPLACE FUNCTION content."searchItems"(search text, "conferenceId" uuid)
RETURNS SETOF content."Item"
LANGUAGE sql STABLE AS $$
SELECT
  *
FROM
  "content"."Item"
WHERE
  (
    search <% ("title")
    OR (
        (SELECT COUNT(*) FROM "content"."ItemTag"
        INNER JOIN "collection"."Tag"
        ON "content"."ItemTag"."itemId" = "content"."Item"."id"
        AND "collection"."Tag"."id" = "content"."ItemTag"."tagId"
        AND search <% "collection"."Tag"."name")
        > 0
    )
    OR (
        (SELECT COUNT(*) FROM "content"."ItemExhibition"
        INNER JOIN "collection"."Exhibition"
        ON "content"."ItemExhibition"."itemId" = "content"."Item"."id"
        AND "collection"."Exhibition"."id" = "content"."ItemExhibition"."exhibitionId"
        AND search <% "collection"."Exhibition"."name")
        > 0
    )
    OR (
        (SELECT COUNT(*) FROM "content"."ItemProgramPerson"
        INNER JOIN "collection"."ProgramPerson"
        ON "content"."ItemProgramPerson"."itemId" = "content"."Item"."id"
        AND "collection"."ProgramPerson"."id" = "content"."ItemProgramPerson"."personId"
        AND (search <% "collection"."ProgramPerson"."name" OR search <% "collection"."ProgramPerson"."affiliation"))
        > 0
    )
    OR (
        (SELECT COUNT(*) FROM "content"."Element"
        WHERE "content"."Element"."itemId" = "content"."Item"."id"
        AND "content"."Element"."data" @? '$[last]."data"."text"'::jsonpath
        AND search <% ("content"."Element"."data" #>> '{-1,data,text}'))
        > 0
    )
  )
  AND "content"."Item"."conferenceId" = "conferenceId"
ORDER BY
  similarity(search, ("title")) DESC;
$$;
