/**
 * ============================================================================
 * File Name: UserController.js
 * Author: Bonita Rodrigues
 * Purpose: Backend controller for user management in the Texas Hold'em web 
 *          application. Handles authentication, session tracking, password 
 *          hashing delegation, user CRUD operations, role-based access 
 *          control (RBAC) security checks, and social friend management.
 * ============================================================================
 */

const dao = require('../model/UserDao');
const passUtil = require('../util/PasswordUtil');


/**
 * Helper utility to safely extract the current username string from session state,
 * supporting both object-based sessions (from login) and string-based sessions.
 * 
 * @param {Object} req - Express request object containing session state
 * @returns {string|null} The username string or null if unauthenticated
 */
function getCurrentUsername(req) {
    if (!req.session.user) return null;
    return typeof req.session.user === 'object' ? req.session.user.login : req.session.user;
}


/**
 * Retrieves and sends all user records to the client. 
 * Enforces administrative security (requires permission level 1).
 * 
 * @param {Object} req - Express request object containing session state
 * @param {Object} res - Express response object
 */
exports.getAll = async function(req, res){
    if(exports.adminCheck(req) === true){ // Security check
        res.status(200); // 200 = Ok
        res.send(await dao.readAll()); // Send all users back to the client
        res.end();
    }else{  // Not admin, should not be able to see all users
        res.status(403); // Forbidden
        res.end();
    } 
};


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
};


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
};


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
        userData.login = req.body.txt_login;     // Username handle
        userData.email = req.body.txt_email;     // Email address
        userData.permission = 2;                  // New signups are always standard players
        userData.points = 1000;                   // Starting chip points

        if(req.body.txt_pass) {
            userData.password = passUtil.hashPassword(req.body.txt_pass);
        }

        // Save new user to MongoDB Atlas
        await dao.create(userData);

        // Establish session object matching login format
        req.session.user = {
            login: userData.login,
            email: userData.email,
            permission: userData.permission,
            points: userData.points
        };

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
};


// ============================================================================
// Social & Friend System Controllers
// ============================================================================

/**
 * Helper utility to safely extract the user's username handle from session state.
 * Falls back to login if username is unpopulated.
 * 
 * @param {Object} req - Express request object containing session state
 * @returns {string|null} The username handle or null if unauthenticated
 */
function getCurrentUserHandle(req) {
    if (!req.session.user) return null;
    if (typeof req.session.user === 'object') {
        return req.session.user.username || req.session.user.login;
    }
    return req.session.user;
}


/**
 * Helper to resolve any stored string (email or username) to its actual username.
 */
async function resolveToUsername(identifier) {
    if (!identifier) return "";
    const found = await dao.findOne({ 
        $or: [{ login: identifier }, { username: identifier }] 
    });
    if (found) {
        return found.username || found.login.split('@')[0];
    }
    return identifier.includes('@') ? identifier.split('@')[0] : identifier;
}


/**
 * Searches for users by username or login query, returning their clean username handles.
 * 
 * @param {Object} req - Express request object containing search query parameters
 * @param {Object} res - Express response object returning JSON array of users
 */
exports.searchUsers = async function(req, res) {
    try {
        const query = req.query.q;
        const currentUsername = getCurrentUserHandle(req);

        // Find matching users
        const rawUsers = await dao.find({
            $and: [
                {
                    $or: [
                        { login: { $regex: query, $options: 'i' } },
                        { username: { $regex: query, $options: 'i' } }
                    ]
                },
                { login: { $ne: currentUsername } },
                { username: { $ne: currentUsername } }
            ]
        }, { login: 1, username: 1, _id: 0 });

        // Map them so the frontend ALWAYS receives a clean username handle
        const users = rawUsers.map(u => ({
            username: u.username || (u.login ? u.login.split('@')[0] : u.login)
        }));

        res.json(users);
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).json({ error: "Server error" });
    }
};


/**
 * Sends a friend request using the sender's and recipient's clean username handles.
 * 
 * @param {Object} req - Express request object containing target user data
 * @param {Object} res - Express response object
 */
exports.sendFriendRequest = async function(req, res) {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) return res.status(401).send("Unauthorized");

        const senderLogin = typeof sessionUser === 'object' ? sessionUser.login : sessionUser;
        const senderDoc = await dao.findOne({ 
            $or: [{ login: senderLogin }, { username: senderLogin }] 
        });
        
        const senderUsername = senderDoc ? (senderDoc.username || senderDoc.login.split('@')[0]) : senderLogin;
        
        // Target user passed from the search result form
        const targetInput = req.body.targetUser;

        // Find the target user's document to get their real username
        const targetDoc = await dao.findOne({
            $or: [{ username: targetInput }, { login: targetInput }]
        });

        const recipientUsername = targetDoc ? (targetDoc.username || targetDoc.login.split('@')[0]) : targetInput;

        if (!senderUsername || senderUsername === recipientUsername) return res.status(400).send("Invalid request");

        // Add sender's clean username handle to recipient's friendRequests array
        await dao.update(
            { 
                $or: [{ login: recipientUsername }, { username: recipientUsername }],
                friendRequests: { $ne: senderUsername }, 
                friends: { $ne: senderUsername } 
            },
            { $push: { friendRequests: senderUsername } }
        );

        res.redirect('/index.html');
    } catch (error) {
        console.error("Error sending friend request:", error);
        res.redirect('/index.html');
    }
};


/**
 * Fetches the active user's friends list and pending requests, automatically 
 * resolving any stored identifiers into clean usernames for display.
 * 
 * @param {Object} req - Express request object containing session state
 * @param {Object} res - Express response object returning JSON data
 */
exports.getFriendsData = async function(req, res) {
    try {
        const currentLogin = getCurrentUsername(req);
        if (!currentLogin) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Find the currently logged-in user record
        const user = await dao.findOne({ 
            $or: [{ login: currentLogin }, { username: currentLogin }] 
        });
        if (!user) return res.status(404).json({ error: "User not found" });

        /**
         * Helper to resolve any stored string (email or username) to its actual username.
         */
        async function resolveToUsername(identifier) {
            if (!identifier) return "";
            const found = await dao.findOne({ 
                $or: [{ login: identifier }, { username: identifier }] 
            });
            if (found) {
                return found.username || found.login.split('@')[0];
            }
            // Fallback if string is already a clean username or email
            return identifier.includes('@') ? identifier.split('@')[0] : identifier;
        }

        // Resolve active friends list to usernames
        const resolvedFriends = [];
        for (const f of (user.friends || [])) {
            resolvedFriends.push(await resolveToUsername(f));
        }

        // Resolve pending requests list to usernames
        const resolvedRequests = [];
        for (const r of (user.friendRequests || [])) {
            resolvedRequests.push(await resolveToUsername(r));
        }

        // Return their resolved friends and pending requests lists
        res.json({
            friends: resolvedFriends,
            friendRequests: resolvedRequests
        });
    } catch (error) {
        console.error("Error fetching friends data:", error);
        res.status(500).json({ error: "Server error" });
    }
};


/**
 * Accepts an incoming friend request, linking both users by their username handles.
 * 
 * @param {Object} req - Express request object containing requester username
 * @param {Object} res - Express response object
 */
exports.acceptFriendRequest = async function(req, res) {
    try {
        const currentHandle = getCurrentUserHandle(req);
        const requester = req.body.requester;

        if (!currentHandle) return res.status(401).send("Unauthorized");

        // Remove from pending requests and add to current user's friends list
        await dao.update({ $or: [{ login: currentHandle }, { username: currentHandle }] }, { 
            $pull: { friendRequests: requester },
            $push: { friends: requester }
        });

        // Add current user's handle to requester's friends list
        await dao.update({ $or: [{ login: requester }, { username: requester }] }, { 
            $push: { friends: currentHandle }
        });

        res.redirect('/index.html');
    } catch (error) {
        console.error("Error accepting request:", error);
        res.redirect('/index.html');
    }
};


/**
 * Declines and removes an incoming friend request from the user's pending list.
 * 
 * @param {Object} req - Express request object containing requester username
 * @param {Object} res - Express response object
 */
exports.declineFriendRequest = async function(req, res) {
    try {
        const currentHandle = getCurrentUserHandle(req);
        const requester = req.body.requester;

        if (!currentHandle) return res.status(401).send("Unauthorized");

        // Remove requester from the user's incoming requests array
        await dao.update({ $or: [{ login: currentHandle }, { username: currentHandle }] }, { 
            $pull: { friendRequests: requester }
        });

        res.redirect('/index.html');
    } catch (error) {
        console.error("Error declining friend request:", error);
        res.redirect('/index.html');
    }
};


// ============================================================================
// Session & Utility Controllers
// ============================================================================

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
};


/**
 * Destroys the active user session by clearing session user data and redirects to lobby.
 * 
 * @param {Object} req - Express request object containing session state
 * @param {Object} res - Express response object
 */
exports.logout = function(req, res){
    req.session.user = null; 
    res.redirect('index.html');
};


/**
 * Helper utility to verify if the currently sessioned user holds administrator privileges.
 * 
 * @param {Object} req - Express request object containing session state
 * @returns {boolean} True if user is logged in and permission equals 1 (Admin)
 */
exports.adminCheck = function(req){ 
    return (req.session.user && req.session.user.permission == 1);
};