import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

type J = any;
const load = (p: string) => JSON.parse(readFileSync(join(__dirname, p), "utf-8"));

(async () => {
  const db = new Client({ connectionString: url });
  await db.connect();

  console.log("🌱 Starting database seed...");

  // --- load fixtures ---
  const shops: J[] = load("shops.json");
  const cards: J[] = load("store_cards.json");
  const shoes: J[] = load("products.running_shoes.json");
  const boards: J[] = load("products.snowboards.json");

  console.log(`📦 Loaded ${shops.length} shops, ${cards.length} store cards, ${shoes.length} shoes, ${boards.length} boards`);

  // --- Create/update shops ---
  const shopIdMap: Record<string, string> = {};
  
  for (const shop of shops) {
    // Check if shop exists
    const existing = await db.query('SELECT id FROM shops WHERE shop_domain = $1', [shop.domain]);
    
    if (existing.rows.length > 0) {
      shopIdMap[shop.shop_id] = existing.rows[0].id;
      console.log(`✓ Found existing shop: ${shop.domain} (${existing.rows[0].id})`);
    } else {
      // Create new shop
      const newId = randomUUID();
      await db.query(`
        INSERT INTO shops (id, shop_domain, installed_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
      `, [newId, shop.domain]);
      shopIdMap[shop.shop_id] = newId;
      console.log(`✓ Created shop: ${shop.domain} (${newId})`);
    }
  }

  // --- seed store_cards ---
  for (const c of cards) {
    const shopUuid = shopIdMap[c.shop_id];
    if (!shopUuid) {
      console.warn(`⚠️  Skipping store card for ${c.shop_id}: shop not found`);
      continue;
    }

    await db.query(`
      INSERT INTO store_cards (shop_id, store_name, shop_domain, brand_voice, policies, merchandising, categories, faqs, version, ttl_days, generated_at)
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, NOW())
      ON CONFLICT (shop_id) DO UPDATE SET
        store_name = EXCLUDED.store_name,
        shop_domain = EXCLUDED.shop_domain,
        brand_voice = EXCLUDED.brand_voice,
        policies = EXCLUDED.policies,
        merchandising = EXCLUDED.merchandising,
        categories = EXCLUDED.categories,
        faqs = EXCLUDED.faqs,
        version = EXCLUDED.version,
        ttl_days = EXCLUDED.ttl_days,
        generated_at = NOW()
    `, [
      shopUuid, c.store_name, c.shop_domain, 
      JSON.stringify(c.brand_voice), 
      JSON.stringify(c.policies),
      JSON.stringify(c.merchandising), 
      JSON.stringify(c.categories), 
      JSON.stringify(c.faqs), 
      c.version, 
      c.ttl_days
    ]);
  }
  console.log(`✓ Seeded ${cards.length} store cards`);

  // --- seed products ---
  let productCount = 0;
  
  for (const p of [...shoes, ...boards]) {
    const price = typeof p.price === "number" && p.price > 0 ? p.price : null;
    if (!price) continue;

    const shopUuid = shopIdMap[p.shop_id];
    if (!shopUuid) {
      console.warn(`⚠️  Skipping product ${p.id}: shop ${p.shop_id} not found`);
      continue;
    }

    // Store all product data in raw field for retrieval
    const raw = {
      original_id: p.id,
      category_path: p.category_path,
      attributes: p.attributes,
      variants: p.variants,
      rating: p.rating,
      review_count: p.review_count,
      in_stock: p.in_stock
    };

    // Check if product with this handle already exists
    const existing = await db.query(
      'SELECT id FROM products WHERE shop_id = $1 AND handle = $2',
      [shopUuid, p.id]
    );

    if (existing.rows.length > 0) {
      // Update existing product
      await db.query(`
        UPDATE products SET
          title = $1,
          description = $2,
          vendor = $3,
          tags = $4,
          raw = $5::jsonb,
          price = $6,
          currency = $7,
          status = $8,
          updated_at = NOW()
        WHERE id = $9
      `, [
        p.title,
        p.description,
        p.vendor || p.brand,
        p.category_path || [],
        JSON.stringify(raw),
        price,
        p.currency || 'USD',
        p.in_stock ? 'active' : 'draft',
        existing.rows[0].id
      ]);
    } else {
      // Insert new product
      // Generate a fake shopify_product_id from hash of product ID
      const shopifyId = Math.abs(p.id.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0));
      
      await db.query(`
        INSERT INTO products (
          id, shop_id, shopify_product_id, handle, title, description, product_type, vendor, 
          tags, raw, price, currency, status, published_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, NOW(), NOW(), NOW())
      `, [
        randomUUID(),
        shopUuid,
        shopifyId,
        p.id, // Use original ID as handle for lookups
        p.title,
        p.description,
        p.category_path?.[p.category_path.length - 1] || 'General',
        p.vendor || p.brand,
        p.category_path || [],
        JSON.stringify(raw),
        price,
        p.currency || 'USD',
        p.in_stock ? 'active' : 'draft',
      ]);
    }
    productCount++;
  }

  console.log(`✓ Seeded ${productCount} products`);
  console.log("✅ Seed complete");
  
  await db.end();
})().catch(e => { console.error(e); process.exit(1); });
