import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '/home/samuel-soita/Development/churchHub/backend/.env' });

const token = jwt.sign(
    { id: 'd5105209-8fbc-4b60-a4ea-35695d2b160e', role: 'SUPER_ADMIN' },
    process.env.JWT_SECRET || 'secret'
);

axios.get('http://localhost:4000/messages?chatType=GLOBAL', {
    headers: { Authorization: `Bearer ${token}` }
}).then(res => console.log('SUCCESS:', res.data))
  .catch(err => {
      console.log('ERROR STATUS:', err.response?.status);
      console.log('ERROR JSON:', JSON.stringify(err.response?.data));
  });
