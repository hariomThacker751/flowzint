const db = require('better-sqlite3')('data/sales_agent.db');

const phone = '919925177759';

const customer = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone);
if (!customer) {
  console.log('Customer not found in local DB');
} else {
  const customerId = customer.id;

  // Turn off FK checks
  db.pragma('foreign_keys = OFF');

  // Try to clean up known related tables just to be safe
  try { db.prepare('DELETE FROM chat_messages WHERE customer_id = ?').run(customerId); } catch (e) {}
  try { db.prepare('DELETE FROM enquiries WHERE customer_id = ?').run(customerId); } catch (e) {}
  try { db.prepare('DELETE FROM quotes WHERE customer_id = ?').run(customerId); } catch (e) {}
  try { db.prepare('DELETE FROM activity_log WHERE customer_id = ?').run(customerId); } catch (e) {}
  try { db.prepare('DELETE FROM orders WHERE customer_id = ?').run(customerId); } catch (e) {}

  // Delete customer
  db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);

  // Turn FK checks back on
  db.pragma('foreign_keys = ON');

  console.log('Deleted customer from local DB.');
}

// Let's also try deleting from Chakra HQ API
require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

async function deleteChakraChat() {
  const apiKey = process.env.CHAKRA_API_KEY;
  if (!apiKey) {
    console.log('Missing Chakra API key');
    return;
  }
  
  try {
    const res = await fetch('https://api.chakrahq.com/v1/ext/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: phone, limit: 10, page: 1 })
    });
    const data = await res.json();
    const chats = data._data || data.data || data.chats || [];
    const chat = chats.find(c => JSON.stringify(c).includes(phone));
    
    if (chat) {
      console.log('Found chat in ChakraHQ:', chat._id || chat.id);
      
      const delRes = await fetch(`https://api.chakrahq.com/v1/ext/chat/${chat._id || chat.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      console.log('Delete chat response status:', delRes.status);
      const delData = await delRes.text();
      console.log('Delete chat response body:', delData);
    } else {
      console.log('Chat not found in ChakraHQ for this phone number.');
    }
  } catch (err) {
    console.error('Error fetching ChakraHQ:', err);
  }
}

deleteChakraChat();
