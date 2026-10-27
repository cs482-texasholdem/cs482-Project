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
 * Helper utility to safely extract the current username string from session state.
 * 
 * @param {Object} req request object containing session state
 * @returns {string|null} The username string or null if unauthenticated
 */
function getCurrentUsername(req) {
    if (!req.session.user) return null;
    return typeof req.session.user === 'object' ? req.session.user.username : req.session.user;
}


/**
 * Retrieves and sends all user records to the client. 
 * Enforces administrative security (requires permission level 1).
 * 
 * @param {Object} req request object containing session state
 * @param {Object} res response object
 */
exports.getAll = async function(req, res){
    if(exports.adminCheck(req) === true){ 
        res.status(200); 
        res.send(await dao.readAll()); 
        res.end();
    }else{  
        res.status(403); 
        res.end();
    } 
};


/**
 * Deletes a specific user record by ID. 
 * Enforces administrative privileges before executing deletion.
 * 
 * @param {Object} req request object containing URL parameters and session
 * @param {Object} res response object
 */
exports.deleteOne = async function(req, res){
    let id = req.params.id; 
    
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
 * @param {Object} req request object containing form body and session
 * @param {Object} res response object
 */
exports.postCreateOrUpdate = async function(req, res){
    let userData = {};
    userData.email = req.body.txt_email;
    userData.username = req.body.txt_username;

    // Check permissions
    if(exports.adminCheck(req) === true && req.body.txt_perm){  
        userData.permission = parseInt(req.body.txt_perm);
    } else { 
        userData.permission = 2; 
    }

    // Capture points if provided
    if(req.body.txt_points) {
        userData.points = parseInt(req.body.txt_points); 
    }

    // Check for ID 
    let userId = req.body.txt_id || req.body.id;

    if(userId){
        console.log('Update user ID:', userId);
        
        // Safety check: only update password if a new one was actually typed in
        if(req.body.txt_pass && req.body.txt_pass.trim() !== "") {
            userData.password = passUtil.hashPassword(req.body.txt_pass);
        } else {
            let existingUser = await dao.read(userId);
            if(existingUser) {
                userData.password = existingUser.password;
            }
        }

        await dao.update(userId, userData); 
    }
    else {
        if(req.body.txt_pass) {
            userData.password = passUtil.hashPassword(req.body.txt_pass);
        }
        await dao.create(userData);        
    }
    
    if(exports.adminCheck(req) === true)
        res.redirect("/admin.html");
    else 
        res.redirect('index.html');
};


/**
 * Registers a new player account with default player permissions and starting chip stack,
 * hashes their password, establishes their session, and redirects to the lobby.
 * 
 * @param {Object} req request object containing registration body data
 * @param {Object} res response object
 */
exports.register = async function(req, res){
    try {
        let userData = {};
        userData.email = req.body.txt_email;         // Email address
        userData.username = req.body.txt_username;   // Username handle
        userData.permission = 2;                     // Standard player
        userData.points = 1000;                      // Starting points

        if(req.body.txt_pass) {
            userData.password = passUtil.hashPassword(req.body.txt_pass);
        }

        // Save new user to MongoDB Atlas
        await dao.create(userData);

        // Establish session object
        req.session.user = {
            email: userData.email,
            username: userData.username,
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
 * Authenticates user credentials against the database using email, verifies hashed passwords,
 * sets up the active session, and redirects based on permission level.
 * 
 * @param {Object} req request object containing login credentials
 * @param {Object} res response object
 */
exports.login = async function(req, res){
    let pemail = req.body.txt_email;
    let user = await dao.findLogin(pemail);

    if(user == null){ 
        res.redirect('login.html?error=1');
    } else {
        if(passUtil.comparePassword(req.body.txt_pass, user.password)){
            console.log("Login successful");
            req.session.user = user;

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
// Social & Friend System Controllers (Cleaned up for Username & Email)
// ============================================================================

/**
 * Helper utility to safely extract the user's username handle from session state.
 */
function getCurrentUserHandle(req) {
    if (!req.session.user) return null;
    if (typeof req.session.user === 'object') {
        return req.session.user.username;
    }
    return req.session.user;
}

/**
 * Helper to resolve any stored identifier into its clean username.
 */
async function resolveToUsername(identifier) {
    if (!identifier) return "";
    const found = await dao.findOne({ 
        $or: [{ email: identifier }, { username: identifier }] 
    });
    if (found) {
        return found.username || found.email.split('@')[0];
    }
    return identifier.includes('@') ? identifier.split('@')[0] : identifier;
}

/**
 * Searches for users by username or email query, returning their clean username handles.
 */
exports.searchUsers = async function(req, res) {
    try {
        const query = req.query.q;
        const currentUsername = getCurrentUserHandle(req);

        const rawUsers = await dao.find({
            $and: [
                {
                    $or: [
                        { email: { $regex: query, $options: 'i' } },
                        { username: { $regex: query, $options: 'i' } }
                    ]
                },
                { username: { $ne: currentUsername } }
            ]
        }, { email: 1, username: 1, _id: 0 });

        const users = rawUsers.map(u => ({
            username: u.username || (u.email ? u.email.split('@')[0] : u.email)
        }));

        res.json(users);
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).json({ error: "Server error" });
    }
};

/**
 * Sends a friend request using clean username handles.
 */
exports.sendFriendRequest = async function(req, res) {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) return res.status(401).send("Unauthorized");

        const senderHandle = typeof sessionUser === 'object' ? sessionUser.username : sessionUser;
        const targetInput = req.body.targetUser;

        const targetDoc = await dao.findOne({
            $or: [{ username: targetInput }, { email: targetInput }]
        });

        const recipientUsername = targetDoc ? (targetDoc.username || targetDoc.email.split('@')[0]) : targetInput;

        if (!senderHandle || senderHandle === recipientUsername) return res.status(400).send("Invalid request");

        await dao.update(
            { 
                $or: [{ email: recipientUsername }, { username: recipientUsername }],
                friendRequests: { $ne: senderHandle }, 
                friends: { $ne: senderHandle } 
            },
            { $push: { friendRequests: senderHandle } }
        );

        res.redirect('/index.html');
    } catch (error) {
        console.error("Error sending friend request:", error);
        res.redirect('/index.html');
    }
};

/**
 * Fetches the active user's friends list and pending requests.
 */
exports.getFriendsData = async function(req, res) {
    try {
        const currentHandle = getCurrentUserHandle(req);
        if (!currentHandle) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const user = await dao.findOne({ 
            $or: [{ email: currentHandle }, { username: currentHandle }] 
        });
        if (!user) return res.status(404).json({ error: "User not found" });

        const resolvedFriends = [];
        for (const f of (user.friends || [])) {
            resolvedFriends.push(await resolveToUsername(f));
        }

        const resolvedRequests = [];
        for (const r of (user.friendRequests || [])) {
            resolvedRequests.push(await resolveToUsername(r));
        }

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
 * Accepts an incoming friend request.
 */
exports.acceptFriendRequest = async function(req, res) {
    try {
        const currentHandle = getCurrentUserHandle(req);
        const requester = req.body.requester;

        if (!currentHandle) return res.status(401).send("Unauthorized");

        await dao.update({ $or: [{ email: currentHandle }, { username: currentHandle }] }, { 
            $pull: { friendRequests: requester },
            $push: { friends: requester }
        });

        await dao.update({ $or: [{ email: requester }, { username: requester }] }, { 
            $push: { friends: currentHandle }
        });

        res.redirect('/index.html');
    } catch (error) {
        console.error("Error accepting request:", error);
        res.redirect('/index.html');
    }
};

/**
 * Declines and removes an incoming friend request.
 */
exports.declineFriendRequest = async function(req, res) {
    try {
        const currentHandle = getCurrentUserHandle(req);
        const requester = req.body.requester;

        if (!currentHandle) return res.status(401).send("Unauthorized");

        await dao.update({ $or: [{ email: currentHandle }, { username: currentHandle }] }, { 
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
 * @param {Object} req request object containing session state
 * @param {Object} res response object
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
 * Destroys the active user session and redirects to lobby.
 * 
 * @param {Object} req request object containing session state
 * @param {Object} res response object
 */
exports.logout = function(req, res){
    req.session.user = null; 
    res.redirect('index.html');
};


/**
 * Helper utility to verify if the currently sessioned user holds administrator privileges.
 * 
 * @param {Object} req request object containing session state
 * @returns {boolean} True if user is logged in and permission equals 1 (Admin)
 */
exports.adminCheck = function(req){ 
    return (req.session.user && req.session.user.permission == 1);
};