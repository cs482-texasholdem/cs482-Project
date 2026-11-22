/**
 * ============================================================================
 * File Name: UserController.js
 * Author: Bonita Rodrigues
 * Purpose: Backend controller for user management in the Texas Hold'em web 
 *          application. Handles authentication, session tracking, password 
 *          hashing delegation, user CRUD operations, role-based access 
 *          control (RBAC) security checks, social friend management, and 
 *          persistent friend direct messaging.
 * ============================================================================
 */

const mongoose = require('mongoose');
const dao = require('../model/UserDao');
const passUtil = require('../util/PasswordUtil');
const FriendMessage = require('../model/FriendMessage');
const presence = require('../model/PresenceManager');
const { avatarPresets, avatarIds } = require('../util/avatarPresets');

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
 * Registers a new player account with default player permissions and a fixed
 * 1000-point starting chip stack, hashes their password, establishes their
 * session, and redirects to the lobby.
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
        userData.points = 1000;                      // Fixed starting points for all new users

        // Clear any temporary guest points from session so stale values don't linger
        if (req.session) {
            delete req.session.pendingGuestPoints;
        }

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

        // Save session if available (Express session provides .save; some unit test mocks omit it)
        if (req.session && typeof req.session.save === "function") {
            req.session.save((err) => {
                if (err) {
                    console.error("Session save error after registration:", err);
                }
                res.redirect('/index.html');
            });
        } else {
            res.redirect('/index.html');
        } 
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

const crypto = require('crypto');

// Optional Nodemailer setup if SMTP credentials are configured in .env
let mailTransporter = null;
try {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const nodemailer = require('nodemailer');
        mailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
} catch (err) {
    console.warn("Nodemailer not configured; reset codes will log to server console.");
}

/**
 * Generates a 6-digit password reset code, stores a 15-minute expiry,
 * and delivers it via email (or logs in non-production if SMTP isn't configured).
 */
exports.requestPasswordReset = async function(req, res) {
    try {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        if (!email) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }

        const user = await dao.findLogin(email);

        // Return a consistent message even if the email isn't found
        if (!user) {
            return res.status(200).json({
                message: "If an account exists for that email, a 6-digit reset code has been sent."
            });
        }

        const code = String(crypto.randomInt(100000, 999999));
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await dao.update(user._id, {
            resetCode: code,
            resetCodeExpires: expiresAt
        });

        if (mailTransporter) {
            await mailTransporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: user.email,
                subject: "Texas Hold'em Password Reset Code",
                text: `Your password reset code is ${code}. It expires in 15 minutes.`
            });
        } else {
            console.log(`[Password Reset] Code for ${user.email}: ${code} (expires ${expiresAt.toISOString()})`);
        }

        return res.status(200).json({
            message: "If an account exists for that email, a 6-digit reset code has been sent."
        });
    } catch (error) {
        console.error("Error requesting password reset:", error);
        return res.status(500).json({ error: "Could not process password reset request." });
    }
};

/**
 * Verifies the 6-digit reset code and updates the user's hashed password.
 */
exports.resetPasswordWithCode = async function(req, res) {
    try {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
        const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

        if (!email || !code || !newPassword) {
            return res.status(400).json({ error: "Email, reset code, and new password are required." });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: "New password must be at least 6 characters long." });
        }

        const user = await dao.findLogin(email);
        if (!user || !user.resetCode || !user.resetCodeExpires) {
            return res.status(400).json({ error: "Invalid or expired reset code." });
        }

        const isExpired = new Date() > new Date(user.resetCodeExpires);
        if (isExpired || user.resetCode !== code) {
            return res.status(400).json({ error: "Invalid or expired reset code." });
        }

        const hashedPassword = passUtil.hashPassword(newPassword);

        await dao.update(user._id, {
            password: hashedPassword,
            resetCode: null,
            resetCodeExpires: null
        });

        return res.status(200).json({
            message: "Password updated successfully. You can now log in with your new password."
        });
    } catch (error) {
        console.error("Error resetting password:", error);
        return res.status(500).json({ error: "Failed to reset password." });
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
 * Fetches the active user's friends list, pending requests, and unread chat counts.
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

        const canonicalUsername = user.username || (user.email ? user.email.split('@')[0] : currentHandle);

        const resolvedFriends = [];
        for (const f of (user.friends || [])) {
            resolvedFriends.push(await resolveToUsername(f));
        }

        const resolvedRequests = [];
        for (const r of (user.friendRequests || [])) {
            resolvedRequests.push(await resolveToUsername(r));
        }

        const unreadAgg = await FriendMessage.aggregate([
            {
                $match: {
                    recipient: { $in: [currentHandle, canonicalUsername].filter(Boolean) },
                    read: false,
                    deleted: { $ne: true }
                }
            },
            {
                $group: {
                    _id: "$sender",
                    count: { $sum: 1 }
                }
            }
        ]);

        const unreadCounts = {};
        for (const entry of unreadAgg) {
            const senderName = await resolveToUsername(entry._id);
            unreadCounts[senderName] = (unreadCounts[senderName] || 0) + entry.count;
        }

        const onlineStatus = {};

        for (const username of resolvedFriends) {
            onlineStatus[username] = presence.isOnline(username);
        }

        res.json({
            friends: resolvedFriends,
            friendRequests: resolvedRequests,
            unreadCounts,
            onlineStatus
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

/**
 * Fetches persistent 1-on-1 chat history between the logged-in user and a friend,
 * and marks incoming unread messages from that friend as read.
 */
exports.getFriendChat = async function(req, res) {
    try {
        const currentUser = getCurrentUserHandle(req);
        const friendUsername = req.params.friendUsername?.trim();

        if (!currentUser) {
            return res.status(401).json({ error: "Not logged in." });
        }
        if (!friendUsername) {
            return res.status(400).json({ error: "Friend username is required." });
        }

        await FriendMessage.updateMany(
            { sender: friendUsername, recipient: currentUser, read: false },
            { $set: { read: true } }
        );

        const messages = await FriendMessage.find({
            $or: [
                { sender: currentUser, recipient: friendUsername },
                { sender: friendUsername, recipient: currentUser }
            ]
        }).sort({ createdAt: 1 });

        return res.status(200).json({ messages });
    } catch (err) {
        console.error("Error loading friend chat:", err);
        return res.status(500).json({ error: "Failed to load messages." });
    }
};

/**
 * Saves a new persistent 1-on-1 message to a friend in MongoDB.
 */
exports.sendFriendChatMessage = async function(req, res) {
    try {
        const currentUser = getCurrentUserHandle(req);
        const friendUsername = req.params.friendUsername?.trim();
        const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

        if (!currentUser) {
            return res.status(401).json({ error: "Not logged in." });
        }
        if (!friendUsername || !text) {
            return res.status(400).json({ error: "Friend and message text are required." });
        }

        const created = await FriendMessage.create({
            sender: currentUser,
            recipient: friendUsername,
            text: text.slice(0, 500)
        });

        return res.status(201).json({ message: created });
    } catch (err) {
        console.error("Error saving friend chat message:", err);
        return res.status(500).json({ error: "Failed to send message." });
    }
};

/**
 * Edits an existing message if and only if the logged-in user is the sender.
 */
exports.editFriendChatMessage = async function(req, res) {
    try {
        const currentUser = getCurrentUserHandle(req);
        const { messageId } = req.params;
        const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

        if (!currentUser) {
            return res.status(401).json({ error: "Not logged in." });
        }
        if (!text) {
            return res.status(400).json({ error: "Updated message text cannot be empty." });
        }

        const updated = await FriendMessage.findOneAndUpdate(
            { _id: messageId, sender: currentUser, deleted: { $ne: true } },
            { text: text.slice(0, 500), edited: true },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: "Message not found, deleted, or not owned by user." });
        }

        return res.status(200).json({ message: updated });
    } catch (err) {
        console.error("Error editing friend chat message:", err);
        return res.status(500).json({ error: "Failed to edit message." });
    }
};

/**
 * Deletes an existing message if and only if the logged-in user is the sender.
 */
exports.deleteFriendChatMessage = async function(req, res) {
    try {
        const currentUser = getCurrentUserHandle(req);
        const { messageId } = req.params;

        if (!currentUser) {
            return res.status(401).json({ error: "Not logged in." });
        }

        const deletedMsg = await FriendMessage.findOneAndUpdate(
            { _id: messageId, sender: currentUser },
            { deleted: true, text: "" },
            { new: true }
        );

        if (!deletedMsg) {
            return res.status(404).json({ error: "Message not found or not owned by user." });
        }

        return res.status(200).json({ message: deletedMsg });
    } catch (err) {
        console.error("Error deleting friend chat message:", err);
        return res.status(500).json({ error: "Failed to delete message." });
    }
};


// ============================================================================
// Messages Controller
// ============================================================================

/**
 * Fetches messages for the currently logged-in user.
 */
exports.getUserMessages = async function(req, res) {
    try {
        const currentHandle = getCurrentUserHandle(req);
        if (!currentHandle) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const user = await dao.findOne({ 
            $or: [{ email: currentHandle }, { username: currentHandle }] 
        });

        if (!user) return res.status(404).json({ error: "User not found" });

        res.status(200).json(user.messages || []);
    } catch (error) {
        console.error("Error fetching user messages:", error);
        res.status(500).json({ error: "Server error" });
    }
};

/**
 * Deletes a specific message from the logged-in user's messages array.
 */
exports.deleteUserMessage = async function(req, res) {
    try {
        const currentHandle = getCurrentUserHandle(req);
        const messageId = req.params.msgId;

        if (!currentHandle) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        await dao.update(
            { $or: [{ email: currentHandle }, { username: currentHandle }] },
            { $pull: { messages: { _id: new mongoose.Types.ObjectId(messageId) } } }
        );

        res.status(200).json({ success: true, message: "Message deleted successfully." });
    } catch (error) {
        console.error("Error deleting user message:", error);
        res.status(500).json({ error: "Server error while deleting message." });
    }
};

// Retrieve a guest's active table chip balance (or session fallback) for the sign-up point transfer flow
exports.getGuestPoints = function(req, res) {
    const { tableManager } = require("./tableController"); // Access active tables from TableManager
    const tableId = req.query.tableId || "main"; // Target table ID or default "main" table
    const playerId = (req.query.playerId || "").trim(); // Guest player ID
    const table = tableManager && typeof tableManager.getTable === "function"
        ? tableManager.getTable(tableId)
        : null;

    if (table && playerId) {
        const player = table.playerManager && typeof table.playerManager.getPlayer === "function"
            ? table.playerManager.getPlayer(playerId)
            : null;

        if (player && typeof player.chips === "number") {
            // Clamp chip stack to a non-negative integer
            return res.status(200).json({ points: Math.max(0, Math.floor(player.chips)) });
        }
    }

    // Fall back to pendingGuestPoints in session or default 1000 starting points
    const fallbackPoints = req.session && typeof req.session.pendingGuestPoints === "number"
        ? Math.max(0, Math.floor(req.session.pendingGuestPoints))
        : 1000;

    return res.status(200).json({ points: fallbackPoints });
};


// ============================================================================
// Session & Utility Controllers
// ============================================================================

// ============================================================================
// Avatar Preset Controllers
// ============================================================================

// Return all available avatar presets
exports.getAvatarPresets = function(req, res) {
    return res.status(200).json({
        avatars: avatarPresets
    });
};


// Update the logged-in user's avatar
exports.updateAvatar = async function(req, res) {

    const username = getCurrentUsername(req);

    // User must be logged in
    if (!username) {
        return res.status(401).json({
            error: "Unauthorized"
        });
    }

    const avatar = req.body?.avatar;

    // Validate the selected avatar
    if (typeof avatar !== "string" || !avatarIds.includes(avatar)) {
        return res.status(400).json({
            error: "Invalid avatar preset"
        });
    }

    try {
        // Update the user's avatar in MongoDB
        const updatedUser = await dao.update(
            {
                $or: [
                    { username },
                    { email: username }
                ]
            },
            {
                $set: { avatar }
            }
        );

        if (!updatedUser) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        // Update the active session
        if (typeof req.session.user === "object") {
            req.session.user.avatar = updatedUser.avatar || avatar;
        }

        return res.status(200).json({
            avatar: updatedUser.avatar || avatar
        });

    } catch (error) {
        console.error("Error updating avatar:", error);

        return res.status(500).json({
            error: "Failed to update avatar"
        });
    }
};


/**
 * Returns the currently active session user data as JSON to the client.
 * 
 * @param {Object} req request object containing session state
 * @param {Object} res response object
 */
exports.loggedUser = async function(req, res){
    res.status(200);
    if (!req.session.user) { 
        res.json(null);
        res.end();
        return;
    }

    try {
        const handle = typeof req.session.user === "object"
            ? req.session.user.username
            : req.session.user;

        const freshUser = await dao.findOne({
            $or: [{ username: handle }, { email: handle }]
        });

        if (freshUser) {
            const updatedSessionUser = typeof req.session.user === "object"
                ? { 
                    ...req.session.user, 
                    points: freshUser.points,
                    avatar: freshUser.avatar || "default" 
                }
                : freshUser;

            req.session.user = updatedSessionUser;
            res.send(updatedSessionUser);
            res.end();
            return;
        }
    } catch (err) {
        console.error("Error refreshing user points in session:", err);
    }

    res.send(req.session.user);
    res.end();
};

/**
 * Destroys the active user session and redirects to lobby.
 * 
 * @param {Object} req request object containing session state
 * @param {Object} res response object
 */
exports.logout = function(req, res){
    req.session.user = null; // Clear user data from session
    const io = req.app.get('io');
    if (io && req.sessionID) {
        io.in(`session:${req.sessionID}`).disconnectSockets(true);
    }
    
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session during logout:", err);
        }
        res.clearCookie('connect.sid', { path: '/' }); // Clear session cookie
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate'); // Prevent caching of sensitive data
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.redirect('/login.html'); // Redirect to sign in page after logout
    });
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