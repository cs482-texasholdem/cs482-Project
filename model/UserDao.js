/**
 * ============================================================================
 * File Name: UserDao.js
 * Author: Bonita Rodrigues
 * Purpose: Data Access Object (DAO) layer for user management. Defines the Mongoose 
 *          schema and database interaction methods (CRUD operations, querying, 
 *          social lookups, and login lookups) connecting MongoDB Atlas to the 
 *          application controllers.
 * ============================================================================
 */

// Call DBConnection on the Server.js
const mongoose = require('mongoose');

/**
 * Mongoose Schema definition for application users.
 * Supports credentials, access control permissions, timestamps, chip points, 
 * active status, and social arrays for friends and requests.
 */
const userSchema = new mongoose.Schema({
    login: { type: String, required: true },
    username: { type: String, required: false, trim: true }, // Optional or auto-mapped to login
    password: String,
    permission: Number,
    creation: { type: Date, default: Date.now },
    points: { type: Number, default: 1000 },
    isActive: { type: Boolean, default: true },

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
 * @param {string} id - The unique MongoDB user ID
 * @returns {Promise<Object|null>} The matching user document or null
 */
exports.read = async function(id){
    let user = await userModel.findById(id);
    return user;
};

/**
 * Creates and saves a new user document to the database.
 * 
 * @param {Object} newuser - Object containing user creation data
 * @returns {Promise<Object>} The newly saved user document including generated ID
 */
exports.create = async function(newuser){
    // Ensure username is populated if only login is provided
    if (newuser.login && !newuser.username) {
        newuser.username = newuser.login;
    }
    const user = new userModel(newuser);
    await user.save();
    return user;
};

/**
 * Deletes a user record by their unique MongoDB ID.
 * 
 * @param {string} id - The unique MongoDB user ID
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
    // should only be used on testing
    await userModel.deleteMany();
};

/**
 * Updates a user record. Supports updating either by MongoDB ID (string) 
 * or by a query condition object (e.g., { login: "username" }).
 * 
 * @param {string|Object} idOrQuery - The unique MongoDB user ID or a query condition object
 * @param {Object} updateData - Object containing fields to update or MongoDB operators (like $push, $pull)
 * @returns {Promise<Object|null>} The updated user document or null
 */
exports.update = async function(idOrQuery, updateData){
    // Check if the first argument is a query object (like { login: '...' }) or an ID string
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
 * Used for searching users by username/login.
 * 
 * @param {Object} query - Mongoose query conditions
 * @param {Object} [projection] - Optional fields to include/exclude
 * @returns {Promise<Array>} Array of matching user documents
 */
exports.find = async function(query, projection = null){
    let users = await userModel.find(query, projection);
    return users;
};

/**
 * Finds and returns a single user document matching a dynamic query condition.
 * Used for looking up users by login/username or email.
 * 
 * @param {Object} query - Mongoose query conditions
 * @returns {Promise<Object|null>} The matching user document or null
 */
exports.findOne = async function(query){
    let user = await userModel.findOne(query);
    return user;
};

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
};