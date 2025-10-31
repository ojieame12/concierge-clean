-- Drop the old function
DROP FUNCTION IF EXISTS search_products_hybrid;

-- Create simplified search function that works with current schema
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
  price DECIMAL,
  similarity_score FLOAT,
  match_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id::TEXT,
    p.handle,
    p.title,
    p.description,
    p.vendor,
    p.product_type,
    p.tags,
    p.status,
    p.price,
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
  WHERE 
    p.shop_id = p_shop
    AND p.status = 'active'
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (
      q_lex IS NULL 
      OR p.title ILIKE '%' || q_lex || '%'
      OR p.description ILIKE '%' || q_lex || '%'
      OR p.vendor ILIKE '%' || q_lex || '%'
      OR p.product_type ILIKE '%' || q_lex || '%'
    )
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_products_hybrid TO authenticated, anon;

SELECT 'search_products_hybrid function updated successfully!' AS status;
