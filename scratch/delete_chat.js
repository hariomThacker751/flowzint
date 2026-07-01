const db = require('better-sqlite3')('data/sales_agent.db');

const phone = '919925177759';

const customer = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone);
if (!customer) {
  console.log('Customer not found');
  process.exit(0);
}

const customerId = customer.id;

// Delete dependencies
db.prepare('DELETE FROM chat_history WHERE customer_id = ?').run(customerId);
db.prepare('DELETE FROM activity_log WHERE customer_id = ?').run(customerId);
db.prepare('DELETE FROM enquiries WHERE customer_id = ?').run(customerId);
db.prepare('DELETE FROM outreach_campaigns WHERE target_audience LIKE ?').run(`%${phone}%`);
db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);

console.log('Deleted customer and associated records from local DB.');

// Let's also see if we can do something with Chakra HQ API
// First, we read the config from .env.local
require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch'); // we can just use native fetch in node 18+

async function deleteChakraChat() {
  const apiKey = process.env.CHAKRA_API_KEY;
  const pluginId = process.env.CHAKRA_PLUGIN_ID;
  if (!apiKey || !pluginId) {
    console.log('Missing Chakra API keys');
    return;
  }
  
  // Try to find chat via search
  try {
    const res = await fetch('https://api.chakrahq.com/v1/ext/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: phone, limit: 10, page: 1, orderField: 'createdAt', orderDirection: 'desc' })
    });
    const data = await res.json();
    const chats = data._data || data.data || data.chats || [];
    const chat = chats.find(c => c.participantId === phone || c.chatName?.includes(phone) || c.contactId === phone || JSON.stringify(c).includes(phone));
    if (chat) {
      console.log('Found chat in ChakraHQ:', chat._id || chat.id);
      
      // Attempt to delete it
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
