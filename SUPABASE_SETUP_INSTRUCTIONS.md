# Supabase Setup Instructions

**Date:** October 30, 2025  
**For:** Insite B2B Conversational Commerce Platform

---

## Overview

Insite uses **Supabase** (PostgreSQL) as its database. You need to:
1. Create a Supabase project
2. Run SQL to create tables
3. Add sample data (shop + products)
4. Update environment variables

**Time:** 15-20 minutes

---

## Step 1: Create Supabase Project

### 1.1 Sign Up / Log In
1. Go to https://supabase.com
2. Sign up or log in with GitHub

### 1.2 Create New Project
1. Click **"New Project"**
2. Fill in details:
   - **Name:** `insite-b2b` (or your preferred name)
   - **Database Password:** Choose a strong password (save it!)
   - **Region:** Choose closest to you
   - **Pricing Plan:** Free tier is fine for testing
3. Click **"Create new project"**
4. Wait 2-3 minutes for project to provision

---

## Step 2: Get Connection Details

### 2.1 Find Your Credentials

1. In your Supabase project, click **"Settings"** (gear icon in sidebar)
2. Click **"Database"**
3. Scroll to **"Connection string"** section
4. Copy the **"URI"** (looks like `postgresql://postgres:[YOUR-PASSWORD]@...`)

### 2.2 Find Your API Keys

1. Click **"Settings" → "API"**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (click "Reveal" to see it)

---

## Step 3: Create Database Tables

### 3.1 Open SQL Editor

1. In Supabase dashboard, click **"SQL Editor"** in sidebar
2. Click **"New query"**

### 3.2 Run This SQL (Copy & Paste All)

```sql
-- ============================================================
-- INSITE B2B DATABASE SCHEMA
-- ============================================================

-- 1. SHOPS TABLE
CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  shop_domain TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE shops IS 'Stores/merchants using Insite';
COMMENT ON COLUMN shops.shop_domain IS 'Unique shop domain (e.g., acme-industrial.com)';

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  vendor TEXT,
  product_type TEXT,
  tags TEXT[],
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, handle)
);

CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_handle ON products(handle);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor);
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN(tags);

COMMENT ON TABLE products IS 'Product catalog';

-- 3. PRODUCT VARIANTS TABLE
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sku TEXT,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  inventory_quantity INTEGER DEFAULT 0,
  available BOOLEAN DEFAULT true,
  option1 TEXT,
  option2 TEXT,
  option3 TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_shop_id ON product_variants(shop_id);
CREATE INDEX IF NOT EXISTS idx_variants_price ON product_variants(price);
CREATE INDEX IF NOT EXISTS idx_variants_available ON product_variants(available);

COMMENT ON TABLE product_variants IS 'Product variants with pricing and inventory';

-- 4. CONVERSATION SESSIONS TABLE
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_shop_id ON conversation_sessions(shop_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON conversation_sessions(session_id);

COMMENT ON TABLE conversation_sessions IS 'User conversation sessions';

-- 5. CONVERSATION EVENTS TABLE
CREATE TABLE IF NOT EXISTS conversation_events (
  id SERIAL PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_shop_id ON conversation_events(shop_id);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON conversation_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON conversation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON conversation_events(created_at);

COMMENT ON TABLE conversation_events IS 'Analytics events from conversations';

-- 6. STORE CARDS TABLE (for caching)
CREATE TABLE IF NOT EXISTS store_cards (
  store_id TEXT PRIMARY KEY,
  card JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_cards_expires_at ON store_cards(expires_at);

COMMENT ON TABLE store_cards IS 'Cached Store Card profiles';

-- 7. PRODUCT ENRICHMENTS TABLE
CREATE TABLE IF NOT EXISTS product_enrichments (
  product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  enrichment_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichments_shop_id ON product_enrichments(shop_id);

COMMENT ON TABLE product_enrichments IS 'AI-generated product enrichments';

-- 8. CATEGORY TAXONOMY TABLE
CREATE TABLE IF NOT EXISTS category_taxonomy (
  id SERIAL PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  parent_category TEXT,
  level INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, category)
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_shop_id ON category_taxonomy(shop_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_category ON category_taxonomy(category);

COMMENT ON TABLE category_taxonomy IS 'Product category hierarchy';

-- 9. NEGOTIATION RULES TABLE
CREATE TABLE IF NOT EXISTS negotiation_rules (
  id SERIAL PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  priority INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_negotiation_shop_id ON negotiation_rules(shop_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_active ON negotiation_rules(active);

COMMENT ON TABLE negotiation_rules IS 'Pricing and offer negotiation rules';

-- 10. BRAND PROFILES TABLE
CREATE TABLE IF NOT EXISTS brand_profiles (
  id SERIAL PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  profile_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, brand_name)
);

CREATE INDEX IF NOT EXISTS idx_brands_shop_id ON brand_profiles(shop_id);

COMMENT ON TABLE brand_profiles IS 'Brand information and positioning';

-- 11. PRODUCT KNOWLEDGE PACKS TABLE
CREATE TABLE IF NOT EXISTS product_knowledge_packs (
  id SERIAL PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  knowledge_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_shop_id ON product_knowledge_packs(shop_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_product_id ON product_knowledge_packs(product_id);

COMMENT ON TABLE product_knowledge_packs IS 'Detailed product knowledge for AI';

-- 12. SHOP ONTOLOGIES TABLE
CREATE TABLE IF NOT EXISTS shop_ontologies (
  id SERIAL PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  ontology_name TEXT NOT NULL,
  ontology_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, ontology_name)
);

CREATE INDEX IF NOT EXISTS idx_ontologies_shop_id ON shop_ontologies(shop_id);

COMMENT ON TABLE shop_ontologies IS 'Shop-specific product ontologies';

-- 13. SHOP ACTIVE ONTOLOGY TABLE
CREATE TABLE IF NOT EXISTS shop_active_ontology (
  shop_id TEXT PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  ontology_id INTEGER NOT NULL REFERENCES shop_ontologies(id) ON DELETE CASCADE,
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE shop_active_ontology IS 'Currently active ontology per shop';

-- 14. SHOP CANON SHARDS TABLE
CREATE TABLE IF NOT EXISTS shop_canon_shards (
  id SERIAL PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  shard_type TEXT NOT NULL,
  shard_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canon_shop_id ON shop_canon_shards(shop_id);
CREATE INDEX IF NOT EXISTS idx_canon_type ON shop_canon_shards(shard_type);

COMMENT ON TABLE shop_canon_shards IS 'Shop knowledge shards for AI context';

-- 15. SHOP CALCULATOR REGISTRY TABLE
CREATE TABLE IF NOT EXISTS shop_calculator_registry (
  id SERIAL PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  calculator_name TEXT NOT NULL,
  calculator_config JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, calculator_name)
);

CREATE INDEX IF NOT EXISTS idx_calculator_shop_id ON shop_calculator_registry(shop_id);

COMMENT ON TABLE shop_calculator_registry IS 'Custom calculators for product recommendations';

-- 16. SHOP UNIT RULES TABLE
CREATE TABLE IF NOT EXISTS shop_unit_rules (
  id SERIAL PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  unit_type TEXT NOT NULL,
  conversion_rules JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, unit_type)
);

CREATE INDEX IF NOT EXISTS idx_units_shop_id ON shop_unit_rules(shop_id);

COMMENT ON TABLE shop_unit_rules IS 'Unit conversion rules for product attributes';

-- Create updated_at triggers for all tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_cards_updated_at BEFORE UPDATE ON store_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 'Database schema created successfully!' AS status;
```

### 3.3 Run the Query

1. Click **"Run"** (or press Ctrl+Enter / Cmd+Enter)
2. Wait for completion (should take 2-3 seconds)
3. You should see: `"Database schema created successfully!"`

---

## Step 4: Add Sample Data

### 4.1 Create a Test Shop

Run this SQL in the SQL Editor:

```sql
-- Insert test shop
INSERT INTO shops (id, shop_domain, name, email, currency, timezone)
VALUES (
  'insite-test-shop',
  'insite-intellgience.myshopify.com',
  'Insite Intelligence Snowboards',
  'shop@insite.com',
  'USD',
  'America/New_York'
)
ON CONFLICT (id) DO UPDATE SET
  shop_domain = EXCLUDED.shop_domain,
  name = EXCLUDED.name,
  updated_at = NOW();

SELECT 'Shop created!' AS status;
```

### 4.2 Add Sample Products

Run this SQL:

```sql
-- Insert sample snowboard products
INSERT INTO products (id, shop_id, handle, title, description, vendor, product_type, tags, status)
VALUES
  (
    'prod-burton-custom',
    'insite-test-shop',
    'burton-custom-snowboard',
    'Burton Custom Snowboard',
    'The most popular snowboard in the world. Perfect for all-mountain riding with a balanced feel.',
    'Burton',
    'Snowboards',
    ARRAY['all-mountain', 'intermediate', 'advanced', 'freestyle'],
    'active'
  ),
  (
    'prod-lib-tech-trs',
    'insite-test-shop',
    'lib-tech-trs',
    'Lib Tech T.Rice Pro',
    'Travis Rice''s signature board. Aggressive all-mountain performance with Magne-Traction edges.',
    'Lib Tech',
    'Snowboards',
    ARRAY['all-mountain', 'advanced', 'powder', 'freeride'],
    'active'
  ),
  (
    'prod-capita-doa',
    'insite-test-shop',
    'capita-doa',
    'Capita Defenders of Awesome',
    'The most versatile board in the Capita line. Great for park, powder, and everything in between.',
    'Capita',
    'Snowboards',
    ARRAY['all-mountain', 'freestyle', 'intermediate', 'park'],
    'active'
  ),
  (
    'prod-jones-flagship',
    'insite-test-shop',
    'jones-flagship',
    'Jones Flagship',
    'Premium all-mountain board with sustainable materials. Perfect for riders who demand performance.',
    'Jones',
    'Snowboards',
    ARRAY['all-mountain', 'advanced', 'eco-friendly', 'freeride'],
    'active'
  ),
  (
    'prod-rome-agent',
    'insite-test-shop',
    'rome-agent',
    'Rome Agent',
    'Versatile freestyle board with a playful feel. Great for park laps and all-mountain fun.',
    'Rome',
    'Snowboards',
    ARRAY['freestyle', 'park', 'intermediate', 'all-mountain'],
    'active'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Insert product variants with pricing
INSERT INTO product_variants (id, product_id, shop_id, title, sku, price, compare_at_price, inventory_quantity, available, option1, image_url)
VALUES
  ('var-burton-custom-156', 'prod-burton-custom', 'insite-test-shop', '156cm', 'BURTON-CUSTOM-156', 549.99, 599.99, 10, true, '156cm', 'https://via.placeholder.com/400x500/3B82F6/FFFFFF?text=Burton+Custom'),
  ('var-burton-custom-158', 'prod-burton-custom', 'insite-test-shop', '158cm', 'BURTON-CUSTOM-158', 549.99, 599.99, 8, true, '158cm', 'https://via.placeholder.com/400x500/3B82F6/FFFFFF?text=Burton+Custom'),
  ('var-lib-tech-157', 'prod-lib-tech-trs', 'insite-test-shop', '157cm', 'LIBTECH-TRS-157', 649.99, null, 5, true, '157cm', 'https://via.placeholder.com/400x500/16A34A/FFFFFF?text=Lib+Tech+TRS'),
  ('var-capita-doa-154', 'prod-capita-doa', 'insite-test-shop', '154cm', 'CAPITA-DOA-154', 499.99, 549.99, 12, true, '154cm', 'https://via.placeholder.com/400x500/F59E0B/FFFFFF?text=Capita+DOA'),
  ('var-jones-flagship-158', 'prod-jones-flagship', 'insite-test-shop', '158cm', 'JONES-FLAG-158', 599.99, null, 6, true, '158cm', 'https://via.placeholder.com/400x500/DC2626/FFFFFF?text=Jones+Flagship'),
  ('var-rome-agent-152', 'prod-rome-agent', 'insite-test-shop', '152cm', 'ROME-AGENT-152', 449.99, 499.99, 15, true, '152cm', 'https://via.placeholder.com/400x500/8B5CF6/FFFFFF?text=Rome+Agent')
ON CONFLICT (id) DO UPDATE SET
  price = EXCLUDED.price,
  inventory_quantity = EXCLUDED.inventory_quantity,
  updated_at = NOW();

SELECT 'Products and variants created!' AS status;
```

---

## Step 5: Update Environment Variables

### 5.1 Backend Environment (.env in project root)

Create or update `/home/ubuntu/concierge-clean/backend/.env`:

```bash
# Supabase Database
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=your_anon_public_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.YOUR_PROJECT_ID.supabase.co:5432/postgres

# Google AI (Gemini)
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# OpenAI (Optional)
OPENAI_API_KEY=your_openai_key_here

# API Authentication
CLIENT_API_KEYS=dev-client-key-123,dev-client-key-456
ADMIN_API_KEY=admin-secret-key-789

# CORS
CORS_ORIGINS=https://3300-i3ays1688pwzsuc0di4va-35ee5faf.manusvm.computer,http://localhost:3300

# Server
PORT=4000
```

**Replace these values:**
- `YOUR_PROJECT_ID` - From Supabase project URL
- `your_anon_public_key_here` - From Supabase Settings → API
- `your_service_role_key_here` - From Supabase Settings → API
- `[YOUR-PASSWORD]` - Database password you chose
- `your_google_ai_api_key_here` - From Google Cloud Console

### 5.2 Frontend Environment (.env.local in frontend/)

Already configured! Just verify it has:

```bash
NEXT_PUBLIC_API_URL=https://4000-i3ays1688pwzsuc0di4va-35ee5faf.manusvm.computer
NEXT_PUBLIC_JOURNEY_SHOP=insite-intellgience.myshopify.com
NEXT_PUBLIC_CLIENT_KEY=dev-client-key-123
```

---

## Step 6: Restart Backend

```bash
# Stop current backend (if running)
pkill -f "tsx watch src/index.ts"

# Start backend with new env vars
cd /home/ubuntu/concierge-clean/backend
npm run dev
```

---

## Step 7: Test the Connection

### 7.1 Test Backend Health

```bash
curl http://localhost:4000/healthz
# Should return: {"status":"ok","timestamp":"..."}
```

### 7.2 Test Chat API

```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-concierge-client-key: dev-client-key-123" \
  -d '{
    "shopDomain": "insite-intellgience.myshopify.com",
    "messages": [{"role": "user", "content": "Show me popular snowboards"}]
  }'
```

Should return a JSON response with product recommendations!

---

## Troubleshooting

### Error: "Missing required environment variable: SUPABASE_URL"

**Fix:** Make sure `.env` file exists in `/home/ubuntu/concierge-clean/backend/` with all variables

### Error: "Invalid client key"

**Fix:** Use header `x-concierge-client-key` (not `x-client-key`)

### Error: "shopDomain is required"

**Fix:** Use `shopDomain` in request body (not `shopId`)

### Error: "Connection refused" or "ECONNREFUSED"

**Fix:** Check Supabase connection string is correct and database is running

### Error: "relation 'products' does not exist"

**Fix:** Run the schema SQL from Step 3 again

---

## Next Steps

After Supabase is set up:

1. ✅ **Test chat interface** - Open https://3300-i3ays1688pwzsuc0di4va-35ee5faf.manusvm.computer
2. ✅ **Try queries** - "Show me popular snowboards", "I have $500 to spend"
3. ✅ **Analyze responses** - Check quality, relevance, conversation flow
4. ✅ **Add more products** - Load your real product catalog
5. ✅ **Configure branding** - Use theme editor to customize UI

---

## Summary Checklist

- [ ] Created Supabase project
- [ ] Ran schema SQL (16 tables created)
- [ ] Added test shop
- [ ] Added sample products (5 snowboards)
- [ ] Updated backend .env with Supabase credentials
- [ ] Restarted backend
- [ ] Tested health endpoint
- [ ] Tested chat API
- [ ] Chat interface works!

**Total time:** 15-20 minutes

---

**Need help?** Check the troubleshooting section or review the error messages in the backend logs.
