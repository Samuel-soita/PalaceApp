
import axios from 'axios';

const testSync = async () => {
    try {
        // We need a valid token. I'll try to find one from a previous session or use search to find an admin.
        // For now, I'll just check if I can reach the endpoint without authentication to see if it's a 401 or 500.
        const response = await axios.get('http://localhost:4000/sync/events?since=2026-04-01T00:00:00Z');
        console.log('Response:', response.status, response.data);
    } catch (error: any) {
        console.log('Error:', error.response?.status, error.response?.data || error.message);
    }
};

testSync();
