import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:4000',
});

async function test() {
    try {
        console.log('Logging in as Bishop...');
        const loginRes = await api.post('/auth/login', {
            membershipNumber: '001/001/2026'
        });
        
        const token = loginRes.data.token;
        console.log('✅ Login successful! Token received.');

        console.log('Fetching Profile...');
        const profileRes = await api.get('/auth/profile', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Profile Response:', profileRes.data);
    } catch (e: any) {
        console.error('❌ Request failed:');
        if (e.response) {
            console.error('Status:', e.response.status);
            console.error('Data:', JSON.stringify(e.response.data, null, 2));
        } else {
            console.error(e.message);
        }
    }
}

test();
