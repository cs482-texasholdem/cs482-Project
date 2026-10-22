// Call DBConnection on the Server.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    login: { type: String, alias: 'email', required: true },
    password: String,
    permission: Number,
    creation: { type: Date, default: Date.now },
    // Adding optional extra fields to match your UI requirements (chips, active status)
    points: { type: Number, default: 1000 },
    isActive: { type: Boolean, default: true }
});

const userModel = mongoose.model('user', userSchema);

exports.readAll = async function(){
    let users = await userModel.find();
    // Later try: find().sort({name:'asc'}).skip(0).limit(5);
    return users;
}

exports.read = async function(id){
    let user = await userModel.findById(id);
    return user;
}

exports.create = async function(newuser){
    const user = new userModel(newuser);
    await user.save();
    return user;
}

exports.del = async function(id){
    let user = await userModel.findByIdAndDelete(id);
    return user;
} 

exports.deleteAll = async function(){
    // should only be used on testing
    await userModel.deleteMany();
}

exports.update = async function(id, updateData){
    // Be careful not to override the hashed password with an unhashed one (handle password updates separately if needed)
    // Using findByIdAndUpdate to modify fields like chips, permission, isActive, or login
    let updatedUser = await userModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    return updatedUser;
}

exports.findLogin = async function(plogin){
    // Since the passwords are hashed, they need to be checked on the controller
    let user = await userModel.findOne({ login: plogin });
    return user;
}