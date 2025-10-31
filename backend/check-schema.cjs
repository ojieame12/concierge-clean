require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Try to get one product to see the schema
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Products table columns:');
    console.log(Object.keys(data[0]).join(', '));
  } else {
    console.log('No products found. Trying to insert a test product to see required fields...');
    const { error: insertError } = await supabase
      .from('products')
      .insert({ title: 'test' });
    console.log('Insert error:', insertError);
  }
})();
