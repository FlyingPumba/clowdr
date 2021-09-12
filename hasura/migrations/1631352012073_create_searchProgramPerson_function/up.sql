CREATE FUNCTION "collection"."searchProgramPerson"(search text) 
returns setof "collection"."ProgramPerson" AS $$ 
SELECT   * 
FROM     "collection"."ProgramPerson" 
WHERE    search <% ( "name" )
      OR search <% ( "affiliation" )
ORDER BY similarity(search, ( "name" )) DESC; 

$$ language sql stable;
