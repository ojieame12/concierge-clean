require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .limit(5);
  
  if (error) {
    console.log('Error:', error);
  } else {
    console.log('Shops:', JSON.stringify(data, null, 2));
  }
})();
