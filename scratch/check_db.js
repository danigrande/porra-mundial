import mongoose from 'mongoose';
import { User } from './agente_mundial/models/User.js';
import { Group } from './agente_mundial/models/Group.js';
import { Prediction } from './agente_mundial/models/Prediction.js';
import dotenv from 'dotenv';

dotenv.config({ path: './agente_mundial/.env' });

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({});
        console.log('Users:', users.map(u => ({ name: u.name, groups: u.groups })));

        const groups = await Group.find({});
        console.log('Groups:', groups.map(g => ({ name: g.name, members: g.members.length })));

        const predictions = await Prediction.find({}).populate('user', 'name').populate('group', 'name');
        console.log('Predictions:', predictions.map(p => ({ 
            user: p.user ? p.user.name : 'Unknown', 
            group: p.group ? p.group.name : 'Unknown',
            updatedAt: p.updatedAt
        })));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkData();
