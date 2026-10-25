/**
 * ============================================================================
 * File Name: UserDao.js
 * Author: Bonita Rodrigues
 * Purpose: Data Access Object (DAO) layer for user management. Defines the Mongoose 
 *          schema and database interaction methods (CRUD operations, querying, 
 *          and login lookups) connecting MongoDB Atlas to the application controllers.
 * ============================================================================
 */

// Call DBConnection on the Server.js
const mongoose = require('mongoose');

/**
 * Mongoose Schema definition for application users.
 * Supports credentials, access control permissions, timestamps, and optional 
 * gaming attributes like chip points and active status.
 */
const userSchema = new mongoose.Schema({
    login: { type: String, alias: 'email', required: true },
    username: { type: String, required: true, unique: true, trim: true},
    password: String,
    permission: Number,
    creation: { type: Date, default: Date.now },
    points: { type: Number, default: 1000 },
    isActive: { type: Boolean, default: true }
});

const userModel = mongoose.model('user', userSchema);

/**
 * Retrieves all user records from the database.
 * 
 * @returns {Promise<Array>} Array of user documents
 */
exports.readAll = async function(){
    let users = await userModel.find();
    return users;
}

/**
 * Finds and returns a single user record by their unique MongoDB ID.
 * 
 * @param {string} id - The unique MongoDB user ID
 * @returns {Promise<Object|null>} The matching user document or null
 */
exports.read = async function(id){
    let user = await userModel.findById(id);
    return user;
}

/**
 * Creates and saves a new user document to the database.
 * 
 * @param {Object} newuser - Object containing user creation data
 * @returns {Promise<Object>} The newly saved user document including generated ID
 */
exports.create = async function(newuser){
    const user = new userModel(newuser);
    await user.save();
    return user;
}

/**
 * Deletes a user record by their unique MongoDB ID.
 * 
 * @param {string} id - The unique MongoDB user ID
 * @returns {Promise<Object|null>} The deleted user document or null
 */
exports.del = async function(id){
    let user = await userModel.findByIdAndDelete(id);
    return user;
} 

/**
 * Wipes all user records from the collection.
 * Note: Should strictly be used for automated testing cleanup.
 * 
 * @returns {Promise<void>}
 */
exports.deleteAll = async function(){
    // should only be used on testing
    await userModel.deleteMany();
}

/**
 * Updates a user record by their unique MongoDB ID with the provided data.
 * 
 * @param {string} id - The unique MongoDB user ID
 * @param {Object} updateData - Object containing fields to update
 * @returns {Promise<Object|null>} The updated user document or null
 */
exports.update = async function(id, updateData){
    // Be careful not to override the hashed password with an unhashed one (handle password updates separately if needed)
    // Using findByIdAndUpdate to modify fields like chips, permission, isActive, or login
    let updatedUser = await userModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    return updatedUser;
}

/**
 * Finds and returns a single user record by their login name.
 * 
 * @param {string} plogin - The login name of the user
 * @returns {Promise<Object|null>} The matching user document or null
 */
exports.findLogin = async function(plogin){
    // Since the passwords are hashed, they need to be checked on the controller
    let user = await userModel.findOne({ login: plogin });
    return user;
}