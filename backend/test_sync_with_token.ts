
import jwt from 'jsonwebtoken';
import axios from 'axios';

const JWT_SECRET = "prayer-palace-secret-key-2026";
const API_URL = "http://localhost:4000";

const testSync = async () => {
    try {
        const userId = "5743cb19-ece9-435c-bddb-b0876f247e15";
        const role = "MEMBER";

        const token = jwt.sign(
            { id: userId, role: role, departmentId: null },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        console.log("Testing with Real User Token:", userId);
        const module = "devotions";
        const since = new Date(0).toISOString();
        
        try {
            const res = await axios.get(`${API_URL}/sync/${module}?since=${since}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Sync Success:", res.status, "Items count:", res.data.length || 0);
        } catch (err: any) {
            console.error("Sync Failure Status:", err.response?.status);
            console.error("Sync Failure Body:", JSON.stringify(err.response?.data, null, 2));
        }
    } catch (error) {
        console.error("Test Setup Error:", error);
    }
};

testSync();
