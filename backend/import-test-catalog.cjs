require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');

function generateUUID() {
  return crypto.randomUUID();
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('📊 Importing Test Catalog to Supabase\n');
  
  // Load the products JSON
  const productsJson = fs.readFileSync('/home/ubuntu/upload/test-merchant/products_supabase.json', 'utf8');
  const products = JSON.parse(productsJson);
  
  console.log(`Loaded ${products.length} products\n`);
  
  // Create shop first
  const shopDomain = 'mountain-modern-test.myshopify.com';
  const shopId = '00000000-0000-0000-0000-000000000001';
  console.log('Creating shop...');
  
  const { data: existingShop } = await supabase
    .from('shops')
    .select('shop_domain')
    .eq('shop_domain', shopDomain)
    .single();
  
  if (!existingShop) {
    const { error: shopError } = await supabase
      .from('shops')
      .insert({
        id: '00000000-0000-0000-0000-000000000001',
        shop_domain: shopDomain,
        name: 'Mountain & Modern Outfitters',
        brand_profile: {}
      });
    
    if (shopError) {
      console.error('Error creating shop:', shopError);
      return;
    }
    console.log('✓ Shop created\n');
  } else {
    console.log('✓ Shop already exists\n');
  }
  
  // Import products in batches
  console.log('Importing products...');
  let imported = 0;
  let failed = 0;
  
  for (const product of products) {
    // Get first variant for price
    const firstVariant = product.variants[0];
    
    const productData = {
      id: generateUUID(),
      shop_id: shopId,
      title: product.title,
      handle: product.handle,
      description: product.body_html,
      vendor: product.vendor,
      product_type: product.product_type,
      tags: product.tags,
      price: firstVariant?.price || 0,
      status: 'active'
    };
    
    const { error } = await supabase
      .from('products')
      .insert(productData);
    
    if (error) {
      console.error(`✗ Failed to import "${product.title}":`, error.message);
      failed++;
    } else {
      imported++;
      if (imported % 10 === 0) {
        console.log(`  Imported ${imported}/${products.length}...`);
      }
    }
  }
  
  console.log(`\n✅ Import complete!`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Failed: ${failed}`);
  console.log(`\n📋 Next: Test the search with "show me snowboards"`);
}

main().catch(console.error);
