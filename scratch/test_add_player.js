
import mongoose from 'mongoose';
import { User } from '../agente_mundial/models/User.js';
import { Group } from '../agente_mundial/models/Group.js';

async function testAddPlayer() {
    try {
        console.log("Connecting to DB...");
        // Use a test DB
        await mongoose.connect('mongodb://localhost:27017/test_porra');
        
        const groupName = "Test Group";
        const playerName = "New Player " + Date.now();
        
        console.log(`Adding player ${playerName} to group ${groupName}`);
        
        // Setup group
        let group = await Group.findOne({ name: groupName });
        if (!group) {
            console.log("Creating test group...");
            const admin = await User.create({ name: "Admin", pin: "1111", phone: "111", groups: [groupName] });
            group = await Group.create({ name: groupName, admin: admin._id, members: [admin._id] });
        }
        
        // Logic from api.js
        let user = await User.findOne({ name: playerName });
        if (!user) {
            console.log("Creating user...");
            user = await User.create({ name: playerName, pin: '1234', phone: '000000', groups: [groupName] });
        } else if (!user.groups.includes(groupName)) {
            console.log("Updating user groups...");
            user.groups.push(groupName);
            await user.save();
        }

        console.log("Updating group members...");
        group = await Group.findOne({ name: groupName });
        if (group && !group.members.includes(user._id)) {
            group.members.push(user._id);
            await group.save();
        }
        
        console.log("✅ Success!");
        
    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await mongoose.connection.close();
    }
}

testAddPlayer();
