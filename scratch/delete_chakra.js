const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    env[key.trim()] = values.join('=').trim().replace(/(^"|"$)/g, '');
  }
});

const phone = '919925177759';

async function deleteChakraChat() {
  const apiKey = env.CHAKRA_API_KEY;
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
