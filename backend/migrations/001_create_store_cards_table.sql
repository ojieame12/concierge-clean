-- Migration: Create store_cards table
-- Description: Stores cached Store Card profiles for each shop
-- Created: 2025-10-29

-- Create store_cards table
CREATE TABLE IF NOT EXISTS store_cards (
  store_id TEXT PRIMARY KEY,
  card JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on expires_at for efficient cache expiration queries
CREATE INDEX IF NOT EXISTS idx_store_cards_expires_at ON store_cards(expires_at);

-- Create index on cached_at for analytics
CREATE INDEX IF NOT EXISTS idx_store_cards_cached_at ON store_cards(cached_at);

-- Add comment to table
COMMENT ON TABLE store_cards IS 'Cached Store Card profiles with brand voice, policies, and merchandising info';

-- Add comments to columns
COMMENT ON COLUMN store_cards.store_id IS 'Unique identifier for the store (shop_id)';
COMMENT ON COLUMN store_cards.card IS 'Complete Store Card JSON object';
COMMENT ON COLUMN store_cards.cached_at IS 'When this Store Card was cached';
COMMENT ON COLUMN store_cards.expires_at IS 'When this Store Card expires (TTL)';

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_store_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
CREATE TRIGGER trigger_store_cards_updated_at
  BEFORE UPDATE ON store_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_store_cards_updated_at();
