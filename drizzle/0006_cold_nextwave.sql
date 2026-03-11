-- Add result column to analysis_tasks for storing AI analysis output (BuildingCompliance JSON).
ALTER TABLE "comman"."analysis_tasks" ADD COLUMN IF NOT EXISTS "result" jsonb;
