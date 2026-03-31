import axios from 'axios';

const API_URL = 'http://localhost:4000/api';

// Assuming from previous context that we have a seeded SECRETARY. Let's try to find one.
// We can use the login flow with a known membership number, or just query the DB directly to get a token if we can't find one.
// We know AdminDashboard had a crash from 'executive:1' and 'api/dashboard/health'.
// Let's query the DB for a SECRETARY user.
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function verify() {
    try {
        console.log('Finding a SECRETARY user...');
        const secretary = await prisma.user.findFirst({
            where: { role: 'SECRETARY' }
        });

        if (!secretary) {
            console.log('No SECRETARY found in the database. Cannot verify endpoints.');
            return;
        }

        console.log(`Found SECRETARY: ${secretary.name} (${secretary.membershipNumber})`);

        // Generate a token manually to bypass login if password is unknown
        const token = jwt.sign(
            { id: secretary.id, role: secretary.role },
            process.env.JWT_SECRET || 'prayer-palace-secret-key-2026',
            { expiresIn: '1d' }
        );

        const config = { headers: { Authorization: `Bearer ${token}` } };

        console.log('\nTesting /dashboard/health...');
        try {
            const healthRes = await axios.get(`${API_URL}/dashboard/health`, config);
            console.log('✅ /dashboard/health: OK', healthRes.status);
        } catch (e: any) {
             console.log('❌ /dashboard/health failed:', e.response?.status, e.response?.data);
        }

        console.log('\nTesting /appointments/all...');
        try {
            const apptRes = await axios.get(`${API_URL}/appointments/all`, config);
            console.log('✅ /appointments/all: OK', apptRes.status);
        } catch (e: any) {
             console.log('❌ /appointments/all failed:', e.response?.status, e.response?.data);
        }

    } catch (e) {
        console.error('Verification script error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
