-- Could not auto-generate a down migration.
-- Please write an appropriate down migration for the SQL below:
alter table "job_queues"."ChannelStackDeleteJob" drop column if exists "mediaLiveChannelId";
