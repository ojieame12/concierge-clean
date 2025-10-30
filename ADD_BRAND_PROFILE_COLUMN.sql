-- Add missing brand_profile column to shops table
-- Run this in Supabase SQL Editor

ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS brand_profile JSONB DEFAULT NULL;

COMMENT ON COLUMN shops.brand_profile IS 'Brand profile and voice configuration';

-- Success message
SELECT 'brand_profile column added successfully!' AS status;
