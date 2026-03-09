CREATE OR REPLACE FUNCTION "base"."handle_new_auth_user"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, base
AS $$
DECLARE
  v_organization_id uuid;
  v_first_name text;
  v_last_name text;
  v_role text;
BEGIN
  v_organization_id := NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::uuid;
  v_first_name := NULLIF(NEW.raw_user_meta_data->>'first_name', '');
  v_last_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'last_name', ''), '');
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'Staff');

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required in raw_user_meta_data';
  END IF;

  IF v_first_name IS NULL THEN
    RAISE EXCEPTION 'first_name is required in raw_user_meta_data';
  END IF;

  IF v_role NOT IN ('Admin', 'Owner', 'Staff') THEN
    RAISE EXCEPTION 'role must be Admin, Owner, or Staff';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "base"."organizations"
    WHERE "id" = v_organization_id
  ) THEN
    RAISE EXCEPTION 'organization_id % does not exist in base.organizations', v_organization_id;
  END IF;

  INSERT INTO "base"."profiles" (
    "id",
    "organization_id",
    "first_name",
    "last_name",
    "role",
    "created_by_id",
    "last_modified_by_id"
  )
  VALUES (
    NEW.id,
    v_organization_id,
    v_first_name,
    v_last_name,
    v_role,
    NEW.id,
    NEW.id
  );

  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "on_auth_user_created_sync_profile" ON auth.users;
--> statement-breakpoint
CREATE TRIGGER "on_auth_user_created_sync_profile"
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION "base"."handle_new_auth_user"();