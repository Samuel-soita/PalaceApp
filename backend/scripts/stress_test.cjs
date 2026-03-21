const axios = require('axios');

async function runLoadTest(concurrency = 200) {
    console.log(`🚀 Authorizing Mission Terminal...`);
    try {
        const authRes = await axios.post('http://localhost:4000/auth/watua-access', {
            secret: 'watua' // The intervention sequence
        });
        const token = authRes.data.token;
        console.log(`✅ Authorization Successful. Token obtained.`);

        console.log(`🛰️ Launching ${concurrency} concurrent missions...`);
        const start = Date.now();
        const requests = Array.from({ length: concurrency }).map(async (_, i) => {
            try {
                const reqStart = Date.now();
                await axios.get('http://localhost:4000/users/technical/stats', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                return Date.now() - reqStart;
            } catch (e) {
                console.error(`- Mission ${i} Failed: ${e.response?.status}`);
                return null;
            }
        });

        const results = await Promise.all(requests);
        const latencies = results.filter(r => r !== null).sort((a, b) => a - b);
        const end = Date.now();

        const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
        const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
        const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

        console.log(`-----------------------------------`);
        console.log(`🏁 TEST COMPLETE in ${end - start}ms`);
        console.log(`- Total Requests: ${concurrency}`);
        console.log(`- Success Rate: ${(latencies.length / concurrency * 100).toFixed(2)}%`);
        console.log(`- AVG Latency: ${avg.toFixed(2)}ms`);
        console.log(`- p95 Latency: ${p95}ms`);
        console.log(`- p99 Latency: ${p99}ms`);
        console.log(`-----------------------------------`);
    } catch (e) {
        console.error('❌ Auth Failure:', e.message);
    }
}

runLoadTest(1000);
