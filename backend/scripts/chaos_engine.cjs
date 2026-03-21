const axios = require('axios');

const CONFIG = {
    CONCURRENCY: 500, // 500 simultaneous chaos users (scaling for test speed)
    TOTAL_MISSIONS: 2000,
    FLAP_RATE: 0.4, // 40% packet loss / simulated offline
    LATENCY_RANGE: [500, 2500], // ms
    DUPLICATE_RATE: 0.1, // 10% duplicate attempts (test idempotency)
    ENDPOINT: 'http://localhost:4000'
};

async function getAuthToken() {
    const res = await axios.post(`${CONFIG.ENDPOINT}/auth/watua-access`, { secret: 'watua' });
    return res.data.token;
}

async function performMission(token, id) {
    const delay = Math.floor(Math.random() * (CONFIG.LATENCY_RANGE[1] - CONFIG.LATENCY_RANGE[0])) + CONFIG.LATENCY_RANGE[0];
    await new Promise(r => setTimeout(r, delay));

    if (Math.random() < CONFIG.FLAP_RATE) {
        throw new Error('NETWORK_TIMEOUT_FLAP');
    }

    const idempotencyKey = `chaos-mission-${id}`;
    const finalKey = Math.random() < CONFIG.DUPLICATE_RATE ? idempotencyKey : `${idempotencyKey}-${Math.random()}`;

    const res = await axios.get(`${CONFIG.ENDPOINT}/users/technical/stats`, {
        headers: { 
            Authorization: `Bearer ${token}`,
            'X-Idempotency-Key': finalKey
        }
    });
    return res.status;
}

async function startChaos() {
    console.log('🌪️  IGNITING PALACE CHAOS ENGINE (STABLE CHUNKED)...');
    const token = await getAuthToken();
    console.log('✅ Mission Terminal Authorized.');

    let success = 0;
    let flaps = 0;
    let errors = 0;

    for (let i = 0; i < CONFIG.TOTAL_MISSIONS; i += CONFIG.CONCURRENCY) {
        const chunk = Array.from({ length: CONFIG.CONCURRENCY }).map(async (_, j) => {
            const missionId = i + j;
            try {
                const status = await performMission(token, missionId);
                if (status === 200) success++;
            } catch (e) {
                if (e.message === 'NETWORK_TIMEOUT_FLAP') flaps++;
                else {
                    console.error(`- Mission ${missionId} CRASHED: ${e.response?.status || e.message}`);
                    errors++;
                }
            }
        });
        await Promise.all(chunk);
        if (i % 500 === 0) console.log(`🛰️ Processed ${i}/${CONFIG.TOTAL_MISSIONS} missions...`);
    }

    console.log('-----------------------------------');
    console.log('🏁 CHAOS MISSION COMPLETE');
    console.log(`- Success missions: ${success}`);
    console.log(`- Simulated Flaps: ${flaps}`);
    console.log(`- Critical Crashes: ${errors}`);
    console.log(`- Reliability Rate: ${((success / (success + errors)) * 100).toFixed(2)}%`);
    console.log('-----------------------------------');
}

startChaos();
