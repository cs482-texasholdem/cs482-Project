/**
 * ============================================================================
 * File Name: UserDao.js
 * Author: Bonita Rodrigues
 * Purpose: Data Access Object (DAO) layer for user management. Defines the Mongoose 
 *          schema and database interaction methods (CRUD operations, querying, 
 *          social lookups, and authentication lookups) connecting MongoDB Atlas to the 
 *          application controllers.
 * ============================================================================
 */

const mongoose = require('mongoose');

/**
 * Mongoose Schema definition for application users.
 * Supports credentials, access control permissions, timestamps, chip points, 
 * active status, and social arrays for friends and requests.
 */
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    permission: { type: Number, default: 2 },
    creation: { type: Date, default: Date.now },
    points: { type: Number, default: 1000 },
    isActive: { type: Boolean, default: true },

    // warnings
    warnings: { type: Number, default: 0 },

    // Store admin warnings/messages
    messages: [{
        sender: { type: String, default: 'Administrator' },
        text: { type: String, required: true },
        date: { type: Date, default: Date.now }
    }],

    // Social Feature Fields
    friends: [{ type: String }],          // List of friend usernames
    friendRequests: [{ type: String }]    // List of incoming request usernames
});

const userModel = mongoose.model('user', userSchema);

// ============================================================================
// Standard CRUD Operations
// ============================================================================

/**
 * Retrieves all user records from the database.
 * 
 * @returns {Promise<Array>} Array of user documents
 */
exports.readAll = async function(){
    let users = await userModel.find();
    return users;
};

/**
 * Finds and returns a single user record by their unique MongoDB ID.
 * 
 * @param {string} id The unique MongoDB user ID
 * @returns {Promise<Object|null>} The matching user document or null
 */
exports.read = async function(id){
    let user = await userModel.findById(id);
    return user;
};

/**
 * Creates and saves a new user document to the database.
 * 
 * @param {Object} newuser Object containing user creation data
 * @returns {Promise<Object>} The newly saved user document including generated ID
 */
exports.create = async function(newuser){
    const user = new userModel(newuser);
    await user.save();
    return user;
};

/**
 * Deletes a user record by their unique MongoDB ID.
 * 
 * @param {string} id The unique MongoDB user ID
 * @returns {Promise<Object|null>} The deleted user document or null
 */
exports.del = async function(id){
    let user = await userModel.findByIdAndDelete(id);
    return user;
}; 

/**
 * Wipes all user records from the collection.
 * Note: Should strictly be used for automated testing cleanup.
 * 
 * @returns {Promise<void>}
 */
exports.deleteAll = async function(){
    await userModel.deleteMany();
};

/**
 * Updates a user record. Supports updating either by MongoDB ID (string) 
 * or by a query condition object (e.g., { email: "user@example.com" }).
 * 
 * @param {string|Object} idOrQuery The unique MongoDB user ID or a query condition object
 * @param {Object} updateData Object containing fields to update or MongoDB operators ($push, $pull)
 * @returns {Promise<Object|null>} The updated user document or null
 */
exports.update = async function(idOrQuery, updateData){
    if (typeof idOrQuery === 'object') {
        let updatedUser = await userModel.findOneAndUpdate(idOrQuery, updateData, { new: true, runValidators: true });
        return updatedUser;
    } else {
        let updatedUser = await userModel.findByIdAndUpdate(idOrQuery, updateData, { new: true, runValidators: true });
        return updatedUser;
    }
};

// ============================================================================
// Custom Query & Social Search Methods
// ============================================================================

/**
 * Finds and returns multiple user records matching a dynamic query condition.
 * 
 * @param {Object} query Mongoose query conditions
 * @param {Object} [projection] Optional fields to include/exclude
 * @returns {Promise<Array>} Array of matching user documents
 */
exports.find = async function(query, projection = null){
    let users = await userModel.find(query, projection);
    return users;
};

/**
 * Finds and returns a single user document matching a dynamic query condition.
 * 
 * @param {Object} query Mongoose query conditions
 * @returns {Promise<Object|null>} The matching user document or null
 */
exports.findOne = async function(query){
    let user = await userModel.findOne(query);
    return user;
};

/**
 * Finds and returns a single user record by their email address for login.
 * 
 * @param {string} pemail The email address of the user
 * @returns {Promise<Object|null>} The matching user document or null
 */
exports.findLogin = async function(pemail){
    let user = await userModel.findOne({ email: pemail });
    return user;
};