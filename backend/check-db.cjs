require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('Checking database...\n');
  
  // Check shops
  const { data: shops } = await supabase
    .from('shops')
    .select('shop_domain, name')
    .limit(10);
  console.log('Shops in DB:', shops?.length || 0);
  if (shops?.length > 0) {
    shops.forEach(s => console.log('  -', s.shop_domain, ':', s.name));
  }
  
  // Check products
  const { data: products } = await supabase
    .from('products')
    .select('id, title, shop_id')
    .limit(10);
  console.log('\nProducts in DB:', products?.length || 0);
  if (products?.length > 0) {
    products.forEach(p => console.log('  -', p.title, '(shop:', p.shop_id + ')'));
  }
})();
