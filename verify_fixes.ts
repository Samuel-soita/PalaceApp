
import axios from 'axios';

const API_URL = 'http://localhost:4000/api';
// Using the Bishop's membership card for testing (seeds usually have it)
const loginData = { membershipNumber: '001/001/2026' };

async function verifyFixes() {
    try {
        console.log('Logging in as Bishop...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, loginData);
        const token = loginRes.data.token;
        const config = { headers: { Authorization: `Bearer ${token}` } };

        console.log('\n1. Verifying /dashboard/sync payload contains createdAt for projects/plans...');
        const syncRes = await axios.get(`${API_URL}/dashboard/sync`, config);
        const { projects, plans } = syncRes.data;

        if (projects.length > 0 && projects[0].createdAt) {
            console.log('✅ Projects include createdAt');
        } else {
            console.log('❌ Projects missing createdAt');
        }

        if (plans.length > 0 && plans[0].createdAt) {
            console.log('✅ Plans include createdAt');
        } else {
            console.log('❌ Plans missing createdAt');
        }

        console.log('\n2. Verifying /users?role=PASTOR accessibility...');
        // We'll test with a Department Leader to ensure the moduleGuard bypass works
        // Dn. Phoebe Kareem: 201/001/2026
        const leaderLogin = await axios.post(`${API_URL}/auth/login`, { membershipNumber: '201/001/2026' });
        const leaderToken = leaderLogin.data.token;
        const leaderConfig = { headers: { Authorization: `Bearer ${leaderToken}` } };

        const usersRes = await axios.get(`${API_URL}/users?role=PASTOR`, leaderConfig);
        if (usersRes.status === 200) {
            console.log('✅ /users?role=PASTOR is accessible to Department Leader');
        } else {
            console.log('❌ /users?role=PASTOR failed for Department Leader');
        }

    } catch (error: any) {
        console.error('Verification failed:', error.response?.data || error.message);
    }
}

verifyFixes();
