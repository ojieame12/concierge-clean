require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('Testing search_products_hybrid...');
  const shopId = '00000000-0000-0000-0000-000000000001';
  console.log('Shop ID:', shopId);
  
  const { data, error } = await supabase.rpc('search_products_hybrid', {
    p_shop: shopId,
    q_vec: null,
    q_lex: 'snowboard',
    p_limit: 10,
    p_min_price: null,
    p_max_price: null,
  });
  
  if (error) {
    console.log('Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Results:', data?.length || 0, 'products');
    if (data?.length > 0) {
      console.log('First product:', JSON.stringify(data[0], null, 2));
    } else {
      console.log('No products returned - checking if products exist...');
      const { data: products } = await supabase
        .from('products')
        .select('id, title, shop_id')
        .eq('shop_id', shopId)
        .limit(5);
      console.log('Products in DB:', products?.length || 0);
      if (products?.length > 0) {
        console.log('Sample product:', products[0]);
      }
    }
  }
})();
