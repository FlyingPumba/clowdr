CREATE TABLE "analytics"."RoomStats"("roomId" uuid NOT NULL, "hlsViewCount" integer NOT NULL DEFAULT 0, PRIMARY KEY ("roomId") , FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON UPDATE cascade ON DELETE cascade);
