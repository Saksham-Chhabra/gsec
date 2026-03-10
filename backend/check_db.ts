import mongoose from 'mongoose';
import { User } from './src/models/User';

async function check() {
    try {
        console.log('Connecting...');
        await mongoose.connect('mongodb://localhost:27017/g-sec');
        console.log('Connected.');
        const count = await User.countDocuments();
        const users = await User.find({}, { username: 1 });
        console.log('User Count:', count);
        console.log('User List:', users.map(u => u.username));
        const alice = await User.findOne({ username: 'Alice' });
        console.log('Alice exists?', !!alice);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
    }
}

check();
