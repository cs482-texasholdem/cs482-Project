/**
 * ============================================================================
 * File Name: UserController.js
 * Author: Bonita Rodrigues
 * Purpose: Backend controller for user management in the Texas Hold'em web 
 *          application. Handles authentication, session tracking, password 
 *          hashing delegation, user CRUD operations, and role-based access 
 *          control (RBAC) security checks.
 * ============================================================================
 */

const dao = require('../model/UserDao');
const passUtil = require('../util/PasswordUtil');


/**
 * Retrieves and sends all user records to the client. 
 * Enforces administrative security (requires permission level 1).
 * 
 * @param {Object} req - Express request object containing session state
 * @param {Object} res - Express response object
 */
exports.getAll = async function(req, res){
    if( exports.adminCheck(req) === true ){ // Security check
        res.status(200); // 200 = Ok
        res.send(await dao.readAll()); // Send all users back to the client
        res.end();
    }else{  // Not admin, should not be able to see all users
        res.status(403); // Forbidden
        res.end();
    } 
}


/**
 * Deletes a specific user record by ID. 
 * Enforces administrative privileges before executing deletion.
 * 
 * @param {Object} req - Express request object containing URL parameters and session
 * @param {Object} res - Express response object
 */
exports.deleteOne = async function(req, res){
    let id = req.params.id; // Get param with id from URL
    
    if(exports.adminCheck(req)){ 
        await dao.del(id);
        res.redirect('/admin.html');
    } else {
        res.status(403);
        res.end();
    }
}


/**
 * Handles both creating new users and updating existing user records from form submissions.
 * Manages conditional password hashing and permission assignments.
 * 
 * @param {Object} req - Express request object containing form body and session
 * @param {Object} res - Express response object
 */
exports.postCreateOrUpdate = async function(req, res){
    let userData = {};
    userData.login = req.body.txt_login;

    // Check permissions
    if(exports.adminCheck(req) === true && req.body.txt_perm){  
        userData.permission = parseInt(req.body.txt_perm);
    } else { 
        userData.permission = 2; // Default to common user permission
    }

    // Capture points if provided
    if(req.body.txt_points) {
        userData.points = parseInt(req.body.txt_points); 
    }

    // Check for ID 
    let userId = req.body.txt_id || req.body.id;

    if(userId){
        // update user record
        console.log('Update user ID:', userId);
        
        // Safety check: only update password if a new one was actually typed in
        if(req.body.txt_pass && req.body.txt_pass.trim() !== "") {
            userData.password = passUtil.hashPassword(req.body.txt_pass);
        } else {
            // Fetch existing user to retain their current hashed password
            let existingUser = await dao.read(userId);
            if(existingUser) {
                userData.password = existingUser.password;
            }
        }

        await dao.update(userId, userData); 
    }
    else {
        // insert new user record
        if(req.body.txt_pass) {
            userData.password = passUtil.hashPassword(req.body.txt_pass);
        }
        await dao.create(userData);        
    }
    // Redirect based on user role after successful creation or update
    if(exports.adminCheck(req) === true)
        res.redirect("/admin.html");
    else 
        res.redirect('index.html');
}


/**
 * Registers a new player account with default player permissions and starting chip stack,
 * hashes their password, establishes their session, and redirects to the lobby.
 * 
 * @param {Object} req - Express request object containing registration body data
 * @param {Object} res - Express response object
 */
exports.register = async function(req, res){
    try {
        let userData = {};
        userData.username = req.body.txt_username;
        userData.email = req.body.txt_login;
        userData.permission = 2; // New signups are always standard players
        userData.points = 1000; // Starting points

        if(req.body.txt_pass) {
            userData.password = passUtil.hashPassword(req.body.txt_pass);
        }

        // Save new user to MongoDB Atlas
        await dao.create(userData);

        // Automatically log them in or redirect them straight to home
        req.session.user = userData.email;
        req.session.permission = 2;

        res.redirect('/index.html');
    } catch (error) {
        console.error("Error during user registration:", error);
        res.redirect('/signup.html');
    }
};


/**
 * Authenticates user credentials against the database, verifies hashed passwords,
 * sets up the active session, and redirects based on permission level.
 * 
 * @param {Object} req - Express request object containing login credentials
 * @param {Object} res - Express response object
 */
exports.login = async function(req, res){
    let plogin = req.body.txt_login;
    let user = await dao.findLogin(plogin);

    if(user == null){ 
        res.redirect('login.html?error=1');
    } else {
        // Verify the provided password against the stored hashed password
        if(passUtil.comparePassword(req.body.txt_pass, user.password)){
            console.log("Login successful");
            req.session.user = user;

            // check for admin
            if(exports.adminCheck(req)){
                res.redirect('admin.html'); 
            } else {
                res.redirect('index.html');
            }
        }
        else{ 
            res.redirect('login.html?error=1');
        }
    } 
}

/**
 * Returns the currently active session user data as JSON to the client.
 * 
 * @param {Object} req - Express request object containing session state
 * @param {Object} res - Express response object
 */
exports.loggedUser = function(req, res){
    res.status(200); 
    if(req.session.user) 
        res.send(req.session.user); 
    else 
        res.json(null); 
    res.end(); 
}

/**
 * Destroys the active user session by clearing session user data and redirects to lobby.
 * 
 * @param {Object} req - Express request object containing session state
 * @param {Object} res - Express response object
 */
exports.logout = function(req, res){
    req.session.user = null; 
    res.redirect('index.html');
}

/**
 * Helper utility to verify if the currently sessioned user holds administrator privileges.
 * 
 * @param {Object} req - Express request object containing session state
 * @returns {boolean} True if user is logged in and permission equals 1 (Admin)
 */
exports.adminCheck = function(req){ 
    return (req.session.user && req.session.user.permission == 1);
}