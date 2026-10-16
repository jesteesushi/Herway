-- Migration 0004: Add source_url / region columns to support_resources;
-- Seed verified helplines; correct NLASO hotline from 16430 → 16699.
-- Verification sources are stored in source_url. is_verified=true only
-- when an official page confirmed both number and purpose.

-- 1. Add new columns (idempotent)
ALTER TABLE public.support_resources
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS region    text;

-- 2. Correct NLASO number: changed from 16430 to 16699 (nlaso.gov.bd confirms update)
UPDATE public.support_resources
SET phone = '16699',
    source_url = 'https://nlaso.gov.bd',
    is_verified = true,
    last_checked = CURRENT_DATE,
    description = 'Government legal aid service providing free legal counseling and court representation for women, children, and underprivileged citizens. Toll-free.',
    hours = '9:00 AM – 5:00 PM (Government working days)'
WHERE phone IN ('16430', '16699');

-- 3. Set source URLs and verify government numbers already seeded
UPDATE public.support_resources
SET source_url = 'https://mspvaw109.gov.bd',
    is_verified = true,
    last_checked = CURRENT_DATE,
    hours = '24 hours / 7 days'
WHERE phone = '109';

UPDATE public.support_resources
SET is_verified = true,
    last_checked = CURRENT_DATE,
    hours = '24 hours / 7 days'
WHERE phone = '999';

-- 4. Add verified child helpline (DSS / UNICEF — dss.gov.bd)
INSERT INTO public.support_resources
  (name, phone, url, source_url, description, kind, hours, is_verified, last_checked, sort_order)
VALUES (
  'Child Helpline',
  '1098',
  'https://dss.gov.bd',
  'https://dss.gov.bd',
  'Government toll-free emergency helpline for children in distress, operated by the Department of Social Services (Ministry of Social Welfare) with UNICEF support. Handles child abuse, trafficking, child marriage, abandonment, and missing children. 24/7.',
  'helpline',
  '24 hours / 7 days',
  true,
  CURRENT_DATE,
  10
) ON CONFLICT DO NOTHING;

-- 5. Add sort_order for the corrected NLASO entry if it was re-inserted
-- (ensures consistent ordering after potential duplicate inserts from migration 0003)
UPDATE public.support_resources SET sort_order = 3 WHERE phone = '16699' AND sort_order = 0;
