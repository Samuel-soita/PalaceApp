import axios from 'axios';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import path from 'path';
// We must import prisma to get real database IDs so the API doesn't 500 crash on missing users
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'church_hub_dev_secret_2026';
const SERVER_URL = 'http://localhost:4000/api';
const TOTAL_USERS = 600;

// Fetch real IDs from the DB so Prisma doesn't crash internally
const generateSyntheticTokens = async () => {
    const realUsers = await prisma.user.findMany({ select: { id: true, role: true, departmentId: true } });
    if (realUsers.length === 0) throw new Error("Database has no users to simulate traffic for.");

    const tokens: string[] = [];
    for (let i = 0; i < TOTAL_USERS; i++) {
        // Randomly pick an existing user's ID
        const real = realUsers[i % realUsers.length];
        
        const payload = {
            id: real.id,
            role: real.role,
            departmentId: real.departmentId
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        tokens.push(token);
    }
    return tokens;
};

// Fire concurrent requests and measure server response integrity
const runStressTest = async () => {
    console.log(`\n🚀 [ChurchHub 2.4.0] Launching 600-User Real-World Load Test...`);
    console.log(`Target: ${SERVER_URL}/dashboard/sync\n`);

    const tokens = await generateSyntheticTokens();
    
    let successCount = 0;
    let failCount = 0;
    let authFailures = 0;
    const latencies: number[] = [];

    const startTime = Date.now();

    // Mapping 600 concurrent asynchronous HTTP calls
    const requests = tokens.map(async (token, index) => {
        const reqStart = Date.now();
        try {
            const res = await axios.get(`${SERVER_URL}/dashboard/sync`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 30000 // 30 second brutal timeout
            });
            if (res.status === 200) {
                successCount++;
                latencies.push(Date.now() - reqStart);
            }
        } catch (error: any) {
            failCount++;
            if (error.response?.status === 401 || error.response?.status === 403) {
                authFailures++;
            }
        }
    });

    await Promise.all(requests);
    const totalTime = Date.now() - startTime;

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
    const maxLatency = Math.max(...latencies, 0);

    console.log(`===============================================`);
    console.log(`📊 CHURCHHUB ENTERPRISE METRICS (600 CONCURRENT USERS)`);
    console.log(`===============================================`);
    console.log(`✅ Success Rate:     ${(successCount / TOTAL_USERS * 100).toFixed(2)}% (${successCount}/${TOTAL_USERS})`);
    console.log(`❌ Failure Rate:     ${(failCount / TOTAL_USERS * 100).toFixed(2)}% (${failCount}/${TOTAL_USERS})`);
    console.log(`🔐 Security Blocks:  ${authFailures} (Unauthorized Attempt Rejections)`);
    console.log(`⏱️ Total Runtime:    ${(totalTime / 1000).toFixed(2)} seconds`);
    console.log(`⚡ Average Latency:  ${avgLatency.toFixed(2)} ms`);
    console.log(`🔥 Peak Server Lag:  ${maxLatency} ms`);
    console.log(`===============================================`);

    if (successCount === TOTAL_USERS && avgLatency < 2000) {
        console.log(`\n🟢 STATUS: PASSED - PRODUCTION READY FOR 600+ CONCURRENT CONNECTIONS!\n`);
        process.exit(0);
    } else {
        console.log(`\n🔴 STATUS: FAILED/DEGRADED - Performance Optimization Required.\n`);
        process.exit(1);
    }
};

runStressTest().catch(console.error);
