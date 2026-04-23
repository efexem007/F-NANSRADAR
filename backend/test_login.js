import fetch from 'node-fetch';

async function testLogin() {
  try {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'demo@finansradar.com',
        password: '123456'
      })
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text);

    try {
      const json = JSON.parse(text);
      console.log('Parsed JSON:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Response is not JSON');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLogin();