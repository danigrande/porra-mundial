
import mongoose from 'mongoose';
import { User } from '../agente_mundial/models/User.js';
import { Group } from '../agente_mundial/models/Group.js';

async function checkJuan() {
    try {
        await mongoose.connect('mongodb://localhost:27017/test_porra'); // Fallback local
        
        const user = await User.findOne({ name: 'Juan' });
        if (!user) {
            console.log("User Juan not found");
            return;
        }
        
        console.log(`User: ${user.name}, ID: ${user._id}`);
        console.log(`Groups: ${user.groups.join(', ')}`);
        
        for (const gName of user.groups) {
            const group = await Group.findOne({ name: gName });
            if (group) {
                const isAdmin = group.admin.toString() === user._id.toString();
                console.log(`Group: ${gName}, Admin ID: ${group.admin}, Is Juan Admin?: ${isAdmin}`);
            }
        }
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
    }
}

checkJuan();
