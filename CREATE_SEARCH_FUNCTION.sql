-- Create hybrid search function for products
-- This combines vector similarity search with lexical (text) search
-- Run this in Supabase SQL Editor

-- First, enable the pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to products table if it doesn't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create index on embedding column for fast vector search
CREATE INDEX IF NOT EXISTS idx_products_embedding 
ON products USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create the hybrid search function
CREATE OR REPLACE FUNCTION search_products_hybrid(
  p_shop TEXT,
  q_vec vector(768) DEFAULT NULL,
  q_lex TEXT DEFAULT NULL,
  p_min_price DECIMAL DEFAULT NULL,
  p_max_price DECIMAL DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id TEXT,
  handle TEXT,
  title TEXT,
  description TEXT,
  vendor TEXT,
  product_type TEXT,
  tags TEXT[],
  status TEXT,
  similarity_score FLOAT,
  match_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.handle,
    p.title,
    p.description,
    p.vendor,
    p.product_type,
    p.tags,
    p.status,
    CASE 
      WHEN q_vec IS NOT NULL AND p.embedding IS NOT NULL THEN 
        1 - (p.embedding <=> q_vec)
      ELSE 0.5
    END AS similarity_score,
    CASE
      WHEN q_vec IS NOT NULL AND p.embedding IS NOT NULL THEN 'vector'
      ELSE 'lexical'
    END AS match_type
  FROM products p
  INNER JOIN product_variants pv ON p.id = pv.product_id
  WHERE 
    p.shop_id = p_shop
    AND p.status = 'active'
    AND pv.available = true
    AND (p_min_price IS NULL OR pv.price >= p_min_price)
    AND (p_max_price IS NULL OR pv.price <= p_max_price)
    AND (
      q_lex IS NULL 
      OR p.title ILIKE '%' || q_lex || '%'
      OR p.description ILIKE '%' || q_lex || '%'
      OR p.vendor ILIKE '%' || q_lex || '%'
      OR p.product_type ILIKE '%' || q_lex || '%'
    )
  GROUP BY p.id, p.handle, p.title, p.description, p.vendor, p.product_type, p.tags, p.status, p.embedding
  ORDER BY 
    CASE 
      WHEN q_vec IS NOT NULL AND p.embedding IS NOT NULL THEN 
        (p.embedding <=> q_vec)
      ELSE 0
    END ASC,
    p.title ASC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION search_products_hybrid TO authenticated, anon;

-- Success message
SELECT 'search_products_hybrid function created successfully!' AS status;
