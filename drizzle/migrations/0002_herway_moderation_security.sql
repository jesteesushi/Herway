-- Migration 0002: Server-side report approval with server location rounding & secure moderator bootstrap

-- 1. Server-side approval function
-- Performs atomic approval, server-side coordinate rounding/jitter, published incident creation,
-- report status update, and audit logging in a single database transaction.
CREATE OR REPLACE FUNCTION public.approve_and_publish_report(
  _report_id uuid,
  _area_label text,
  _summary text,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mod_id uuid;
  _rep record;
  _pub_id uuid;
  _grid constant double precision := 0.004;
  _lat double precision;
  _lng double precision;
BEGIN
  _mod_id := auth.uid();
  IF _mod_id IS NULL OR NOT public.is_moderator(_mod_id) THEN
    RAISE EXCEPTION 'Unauthorized: only moderators can approve reports';
  END IF;

  IF char_length(trim(coalesce(_area_label, ''))) < 3 THEN
    RAISE EXCEPTION 'A general area name of at least 3 characters is required';
  END IF;

  IF char_length(trim(coalesce(_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'An audit reason of at least 3 characters is required';
  END IF;

  -- Lock report row for update to prevent concurrent duplicate approval
  SELECT * INTO _rep FROM public.incident_reports WHERE id = _report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  -- Server-side rounding and random jitter applied directly to private report coordinates.
  -- Snaps to ~450m grid (0.004 deg) and applies bounded jitter (within ~150m), rounded to 4 decimals.
  _lat := round(((round(_rep.lat / _grid) * _grid) + ((random() - 0.5) * 0.003))::numeric, 4);
  _lng := round(((round(_rep.lng / _grid) * _grid) + ((random() - 0.5) * 0.003))::numeric, 4);

  IF _rep.published_id IS NOT NULL THEN
    UPDATE public.published_incidents
    SET category = _rep.category,
        report_type = _rep.report_type,
        lat = _lat,
        lng = _lng,
        area_label = trim(_area_label),
        date_from = _rep.date_from,
        date_to = _rep.date_to,
        summary = nullif(trim(_summary), ''),
        updated_at = now()
    WHERE id = _rep.published_id;
    _pub_id := _rep.published_id;
  ELSE
    INSERT INTO public.published_incidents (
      category, report_type, lat, lng,
      area_label, date_from, date_to, summary, is_sample
    ) VALUES (
      _rep.category, _rep.report_type, _lat, _lng,
      trim(_area_label), _rep.date_from, _rep.date_to, nullif(trim(_summary), ''), false
    ) RETURNING id INTO _pub_id;
  END IF;

  -- Update report status and link to published incident
  UPDATE public.incident_reports
  SET status = 'published',
      published_id = _pub_id,
      updated_at = now()
  WHERE id = _report_id;

  -- Write to moderation audit log
  INSERT INTO public.moderation_actions (
    report_id, published_id, moderator_id, action, reason
  ) VALUES (
    _report_id, _pub_id, _mod_id, 'approved', trim(_reason)
  );

  RETURN jsonb_build_object(
    'published_id', _pub_id,
    'lat', _lat,
    'lng', _lng,
    'status', 'published'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_and_publish_report(uuid, text, text, text) TO authenticated;

-- Atomic removal of a published incident
CREATE OR REPLACE FUNCTION public.remove_published_report(
  _report_id uuid,
  _reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mod_id uuid;
  _rep record;
  _old_pub_id uuid;
BEGIN
  _mod_id := auth.uid();
  IF _mod_id IS NULL OR NOT public.is_moderator(_mod_id) THEN
    RAISE EXCEPTION 'Unauthorized: only moderators can remove reports';
  END IF;

  IF char_length(trim(coalesce(_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'A reason of at least 3 characters is required';
  END IF;

  SELECT * INTO _rep FROM public.incident_reports WHERE id = _report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  _old_pub_id := _rep.published_id;
  IF _old_pub_id IS NOT NULL THEN
    DELETE FROM public.published_incidents WHERE id = _old_pub_id;
  END IF;

  UPDATE public.incident_reports
  SET status = 'removed', published_id = null, updated_at = now()
  WHERE id = _report_id;

  INSERT INTO public.moderation_actions (
    report_id, published_id, moderator_id, action, reason
  ) VALUES (
    _report_id, _old_pub_id, _mod_id, 'removed', trim(_reason)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_published_report(uuid, text) TO authenticated;

-- 2. Helper to check if any moderator exists in the system
CREATE OR REPLACE FUNCTION public.can_bootstrap_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role IN ('moderator', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_bootstrap_moderator() TO anon, authenticated;

-- 3. Safe way to claim first moderator/admin role
-- Can only be claimed if ZERO moderators or admins exist in the entire system.
-- Once the first moderator is created, this function is permanently locked.
CREATE OR REPLACE FUNCTION public.claim_first_moderator(_secret_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mod_count integer;
  _uid uuid;
  _expected_token text;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to claim initial moderator role';
  END IF;

  -- Verify no moderators or admins exist yet
  SELECT count(*) INTO _mod_count FROM public.user_roles WHERE role IN ('moderator', 'admin');
  IF _mod_count > 0 THEN
    RAISE EXCEPTION 'Moderator bootstrap is permanently closed: a moderator already exists';
  END IF;

  -- Check if an expected token is configured in db settings
  BEGIN
    _expected_token := current_setting('app.settings.bootstrap_token', true);
  EXCEPTION WHEN OTHERS THEN
    _expected_token := NULL;
  END;

  IF _expected_token IS NOT NULL AND _expected_token <> '' THEN
    IF _secret_token IS NULL OR _secret_token <> _expected_token THEN
      RAISE EXCEPTION 'Invalid bootstrap token';
    END IF;
  ELSE
    -- Require non-empty secret with minimum 8 characters to prevent accidental activation
    IF _secret_token IS NULL OR char_length(trim(_secret_token)) < 8 THEN
      RAISE EXCEPTION 'A secret token of at least 8 characters is required';
    END IF;
  END IF;

  -- Insert admin and moderator roles for the user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'moderator')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Append audit entry
  INSERT INTO public.moderation_actions (
    moderator_id, action, reason
  ) VALUES (
    _uid, 'bootstrap_first_moderator', 'Initial moderator and admin role claimed via bootstrap'
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_first_moderator(text) TO authenticated;

-- 4. Role assignment by existing admins
CREATE OR REPLACE FUNCTION public.assign_user_role(_target_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: only admins can assign roles';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.moderation_actions (
    moderator_id, action, reason
  ) VALUES (
    auth.uid(), 'role_assigned', 'Assigned ' || _role::text || ' to user ' || _target_user_id::text
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, public.app_role) TO authenticated;
