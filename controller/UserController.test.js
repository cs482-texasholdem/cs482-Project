const controller = require('./UserController');
const dao = require('../model/UserDao');
const passUtil = require('../util/PasswordUtil');
const FriendMessage = require('../model/FriendMessage');

jest.mock('../model/UserDao');
jest.mock('../util/PasswordUtil');
jest.mock('../model/FriendMessage');

beforeEach(function(){
    jest.clearAllMocks();
});

// ==========================================
// 1. adminCheck Tests
// ==========================================
test('adminCheck should return true for admin user (permission == 1)', function(){
    let req = { session: { user: { permission: 1 } } };
    expect(controller.adminCheck(req)).toBe(true);
});

test('adminCheck should return false for regular player (permission == 2)', function(){
    let req = { session: { user: { permission: 2 } } };
    expect(controller.adminCheck(req)).toBe(false);
});

// ==========================================
// 2. getAll Tests
// ==========================================
test('getAll should call dao.readAll and send the result when user is admin', async function(){
    let req = { session: { user: { permission: 1 } } };
    let res = {
        status: jest.fn(),
        send: jest.fn(),
        end: jest.fn()
    };
    dao.readAll.mockResolvedValue([{ username: 'adminUser', email: 'admin@mail.com' }]);

    await controller.getAll(req, res);

    expect(dao.readAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([{ username: 'adminUser', email: 'admin@mail.com' }]);
    expect(res.end).toHaveBeenCalled();
});

test('getAll should return 403 Forbidden when user is not an admin', async function(){
    let req = { session: { user: { permission: 2 } } };
    let res = {
        status: jest.fn(),
        send: jest.fn(),
        end: jest.fn()
    };

    await controller.getAll(req, res);

    expect(dao.readAll).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.end).toHaveBeenCalled();
});

// ==========================================
// 3. deleteOne Tests
// ==========================================
test('deleteOne should delete user and redirect to admin.html when admin', async function(){
    let req = { 
        session: { user: { permission: 1 } },
        params: { id: '65abc123' }
    };
    let res = {
        redirect: jest.fn(),
        status: jest.fn(),
        end: jest.fn()
    };
    dao.del.mockResolvedValue(true);

    await controller.deleteOne(req, res);

    expect(dao.del).toHaveBeenCalledWith('65abc123');
    expect(res.redirect).toHaveBeenCalledWith('/admin.html');
});

test('deleteOne should forbid access when non-admin tries to delete', async function(){
    let req = { 
        session: { user: { permission: 2 } },
        params: { id: '65abc123' }
    };
    let res = {
        redirect: jest.fn(),
        status: jest.fn(),
        end: jest.fn()
    };

    await controller.deleteOne(req, res);

    expect(dao.del).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.end).toHaveBeenCalled();
});

// ==========================================
// 4. register Tests
// ==========================================
test('register should create user, set session object, and redirect to index.html on success', async function(){
    let req = {
        body: { txt_username: 'newplayer', txt_email: 'newplayer@mail.com', txt_pass: 'secure123' },
        session: {}
    };
    let res = { redirect: jest.fn() };
    passUtil.hashPassword.mockReturnValue('hashedPassword');
    dao.create.mockResolvedValue({ _id: '1' });

    await controller.register(req, res);

    expect(passUtil.hashPassword).toHaveBeenCalledWith('secure123');
    expect(dao.create).toHaveBeenCalled();
    expect(req.session.user).toEqual({
        email: 'newplayer@mail.com',
        username: 'newplayer',
        permission: 2,
        points: 1000
    });
    expect(res.redirect).toHaveBeenCalledWith('/index.html');
});

test('register should catch database errors and redirect to signup.html', async function(){
    let req = {
        body: { txt_username: 'erroruser', txt_email: 'error@mail.com' },
        session: {}
    };
    let res = { redirect: jest.fn() };
    dao.create.mockRejectedValue(new Error('DB connection failed'));

    await controller.register(req, res);

    expect(res.redirect).toHaveBeenCalledWith('/signup.html');
});

test('register should enforce 1000 starting points even if txt_points is submitted', async function(){
    let req = {
        body: {
            txt_username: 'guestconvert',
            txt_email: 'guestconvert@mail.com',
            txt_pass: 'secure123',
            txt_points: '1850'
        },
        session: {
            save: jest.fn((cb) => cb && cb())
        }
    };
    let res = { redirect: jest.fn() };
    passUtil.hashPassword.mockReturnValue('hashedPassword');
    dao.create.mockResolvedValue({ _id: '2', points: 1000 });

    await controller.register(req, res);

    expect(dao.create).toHaveBeenCalledWith(expect.objectContaining({
        username: 'guestconvert',
        points: 1000
    }));
    expect(req.session.user.points).toBe(1000);
    expect(res.redirect).toHaveBeenCalledWith('/index.html');
});

test('register should enforce 1000 starting points and clear stale req.session.pendingGuestPoints', async function(){
    let req = {
        body: {
            txt_username: 'sessionguest',
            txt_email: 'sessionguest@mail.com',
            txt_pass: 'secure123'
        },
        session: {
            pendingGuestPoints: 2400,
            save: jest.fn((cb) => cb && cb())
        }
    };
    let res = { redirect: jest.fn() };
    passUtil.hashPassword.mockReturnValue('hashedPassword');
    dao.create.mockResolvedValue({ _id: '3', points: 1000 });

    await controller.register(req, res);

    expect(dao.create).toHaveBeenCalledWith(expect.objectContaining({
        points: 1000
    }));
    expect(req.session.pendingGuestPoints).toBeUndefined();
    expect(res.redirect).toHaveBeenCalledWith('/index.html');
});

// ==========================================
// 5. login Tests
// ==========================================
test('login should redirect with error=1 when user does not exist', async function(){
    let req = { body: { txt_email: 'nonexistent@mail.com' } };
    let res = { redirect: jest.fn() };
    dao.findLogin.mockResolvedValue(null);

    await controller.login(req, res);

    expect(res.redirect).toHaveBeenCalledWith('login.html?error=1');
});

test('login should succeed and redirect admin to admin.html', async function(){
    let req = { body: { txt_email: 'admin@mail.com', txt_pass: 'correct' }, session: {} };
    let res = { redirect: jest.fn() };
    let adminUser = { email: 'admin@mail.com', username: 'admin', password: 'hashed', permission: 1 };
    
    dao.findLogin.mockResolvedValue(adminUser);
    passUtil.comparePassword.mockReturnValue(true);

    await controller.login(req, res);

    expect(req.session.user).toEqual(adminUser);
    expect(res.redirect).toHaveBeenCalledWith('admin.html');
});

test('login should succeed and redirect standard player to index.html', async function(){
    let req = { body: { txt_email: 'player@mail.com', txt_pass: 'correct' }, session: {} };
    let res = { redirect: jest.fn() };
    let playerUser = { email: 'player@mail.com', username: 'player', password: 'hashed', permission: 2 };
    
    dao.findLogin.mockResolvedValue(playerUser);
    passUtil.comparePassword.mockReturnValue(true);

    await controller.login(req, res);

    expect(req.session.user).toEqual(playerUser);
    expect(res.redirect).toHaveBeenCalledWith('index.html');
});

test('login should fail and redirect with error=1 when password check fails', async function(){
    let req = { body: { txt_email: 'admin@mail.com', txt_pass: 'wrong' } };
    let res = { redirect: jest.fn() };
    dao.findLogin.mockResolvedValue({ email: 'admin@mail.com', password: 'hashed' });
    passUtil.comparePassword.mockReturnValue(false);

    await controller.login(req, res);

    expect(res.redirect).toHaveBeenCalledWith('login.html?error=1');
});

// ==========================================
// 6. loggedUser & logout Tests
// ==========================================
test('loggedUser should send active session user with status 200', async function(){
    let req = { session: { user: { username: 'activeUser', email: 'active@mail.com' } } };
    let res = {
        status: jest.fn(),
        send: jest.fn(),
        end: jest.fn()
    };
    dao.findOne.mockResolvedValue({ username: 'activeUser', email: 'active@mail.com', points: 1000 });

    await controller.loggedUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ username: 'activeUser', email: 'active@mail.com' }));
    expect(res.end).toHaveBeenCalled();
});

test('loggedUser should refresh points from UserDao when available', async function(){
    let req = {
        session: {
            user: { username: 'activeUser', email: 'active@mail.com', points: 1000 }
        }
    };
    let res = {
        status: jest.fn(),
        send: jest.fn(),
        end: jest.fn()
    };
    dao.findOne.mockResolvedValue({
        username: 'activeUser',
        email: 'active@mail.com',
        points: 1625
    });

    await controller.loggedUser(req, res);

    expect(dao.findOne).toHaveBeenCalled();
    expect(req.session.user.points).toBe(1625);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ points: 1625 }));
    expect(res.end).toHaveBeenCalled();
});

test('loggedUser should send null JSON when no user session is active', function(){
    let req = { session: {} };
    let res = {
        status: jest.fn(),
        json: jest.fn(),
        end: jest.fn()
    };

    controller.loggedUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(null);
    expect(res.end).toHaveBeenCalled();
});

test('logout should clear session user and redirect to login.html', function(){
    const req = { session: { user: { username: 'activeUser'}, destroy: jest.fn((callback) => callback(null)) } };
    const res = { redirect: jest.fn(), clearCookie: jest.fn(), setHeader: jest.fn() };

    controller.logout(req, res);

    expect(req.session.user).toBeNull();
    expect(req.session.destroy).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/login.html');
});

// ==========================================
// 8. Social & Friend System Tests
// ==========================================
test('searchUsers should query DAO and return matching usernames as JSON', async function(){
    let req = {
        query: { q: 'bub' },
        session: { user: { email: 'alice@mail.com', username: 'alice' } }
    };
    let res = {
        json: jest.fn()
    };
    dao.find.mockResolvedValue([{ username: 'bubbles', email: 'bubbles@mail.com' }]);

    await controller.searchUsers(req, res);

    expect(dao.find).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([{ username: 'bubbles' }]);
});

test('sendFriendRequest should push sender username into recipient friendRequests and redirect', async function(){
    let req = {
        body: { targetUser: 'bubbles' },
        session: { user: { email: 'alice@mail.com', username: 'alice' } }
    };
    let res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
    };
    
    dao.findOne.mockResolvedValue({ username: 'bubbles', email: 'bubbles@mail.com' });
    dao.update.mockResolvedValue(true);

    await controller.sendFriendRequest(req, res);

    expect(dao.update).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/index.html');
});

test('getFriendsData should return resolved friends, requests, and unreadCounts JSON', async function(){
    let req = {
        session: { user: { email: 'alice@mail.com', username: 'alice' } }
    };
    let res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };

    dao.findOne
        .mockResolvedValueOnce({
            username: 'alice',
            friends: ['bob'],
            friendRequests: ['charlie']
        })
        .mockResolvedValueOnce({ username: 'bob' })
        .mockResolvedValueOnce({ username: 'charlie' })
        .mockResolvedValueOnce({ username: 'bob' });

    FriendMessage.aggregate.mockResolvedValue([
        { _id: 'bob', count: 2 }
    ]);

    await controller.getFriendsData(req, res);

    expect(res.json).toHaveBeenCalledWith({
        friends: ['bob'],
        friendRequests: ['charlie'],
        unreadCounts: { bob: 2 },
        onlineStatus: { bob: false }
    });
});

test('acceptFriendRequest should move requester from requests to friends and update both users', async function(){
    let req = {
        body: { requester: 'charlie' },
        session: { user: { email: 'alice@mail.com', username: 'alice' } }
    };
    let res = {
        redirect: jest.fn()
    };
    dao.update.mockResolvedValue(true);

    await controller.acceptFriendRequest(req, res);

    expect(dao.update).toHaveBeenCalledTimes(2);
    expect(res.redirect).toHaveBeenCalledWith('/index.html');
});

test('declineFriendRequest should remove requester from friendRequests array and redirect', async function(){
    let req = {
        body: { requester: 'charlie' },
        session: { user: { email: 'alice@mail.com', username: 'alice' } }
    };
    let res = {
        redirect: jest.fn()
    };
    dao.update.mockResolvedValue(true);

    await controller.declineFriendRequest(req, res);

    expect(dao.update).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/index.html');
});

// ==========================================
// 9. Social & Friend System Error & Guard Tests
// ==========================================
test('searchUsers should handle database errors and return 500 status', async function(){
    let req = {
        query: { q: 'bub' },
        session: { user: { email: 'alice@mail.com', username: 'alice' } }
    };
    let res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };
    dao.find.mockRejectedValue(new Error('Database search failed'));

    await controller.searchUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Server error" });
});

test('sendFriendRequest should return 401 Unauthorized if user is not sessioned', async function(){
    let req = { body: { targetUser: 'bubbles' }, session: {} };
    let res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

    await controller.sendFriendRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith("Unauthorized");
});

test('sendFriendRequest should catch errors and redirect to index.html', async function(){
    let req = {
        body: { targetUser: 'bubbles' },
        session: { user: { email: 'alice@mail.com', username: 'alice' } }
    };
    let res = { redirect: jest.fn() };
    dao.findOne.mockRejectedValue(new Error('DB error'));

    await controller.sendFriendRequest(req, res);

    expect(res.redirect).toHaveBeenCalledWith('/index.html');
});

test('getFriendsData should return 401 Unauthorized if not logged in', async function(){
    let req = { session: {} };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.getFriendsData(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
});

test('getFriendsData should return 404 if user document is not found', async function(){
    let req = { session: { user: { email: 'alice@mail.com', username: 'alice' } } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    res.status.mockReturnValue(res);
    dao.findOne.mockResolvedValue(null);

    await controller.getFriendsData(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
});

test('getFriendsData should catch errors and return 500 status', async function(){
    let req = { session: { user: { email: 'alice@mail.com', username: 'alice' } } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    res.status.mockReturnValue(res);
    dao.findOne.mockRejectedValue(new Error('DB failure'));

    await controller.getFriendsData(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Server error" });
});

test('acceptFriendRequest should return 401 if unauthenticated', async function(){
    let req = { session: {}, body: { requester: 'charlie' } };
    let res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

    await controller.acceptFriendRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith("Unauthorized");
});

test('acceptFriendRequest should catch errors and redirect to index.html', async function(){
    let req = {
        body: { requester: 'charlie' },
        session: { user: { email: 'alice@mail.com', username: 'alice' } }
    };
    let res = { redirect: jest.fn() };
    dao.update.mockRejectedValue(new Error('DB error'));

    await controller.acceptFriendRequest(req, res);

    expect(res.redirect).toHaveBeenCalledWith('/index.html');
});

test('declineFriendRequest should return 401 if unauthenticated', async function(){
    let req = { session: {}, body: { requester: 'charlie' } };
    let res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

    await controller.declineFriendRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith("Unauthorized");
});

test('declineFriendRequest should catch errors and redirect to index.html', async function(){
    let req = {
        body: { requester: 'charlie' },
        session: { user: { email: 'alice@mail.com', username: 'alice' } }
    };
    let res = { redirect: jest.fn() };
    dao.update.mockRejectedValue(new Error('DB error'));

    await controller.declineFriendRequest(req, res);

    expect(res.redirect).toHaveBeenCalledWith('/index.html');
});

// ==========================================
// 10. postCreateOrUpdate Tests
// ==========================================
test('postCreateOrUpdate should update user with password and admin permission when admin', async function(){
    let req = {
        session: { user: { permission: 1 } },
        body: {
            txt_email: 'update@mail.com',
            txt_username: 'updateduser',
            txt_perm: '1',
            txt_points: '500',
            txt_id: 'user123',
            txt_pass: 'newpass123'
        }
    };
    let res = { redirect: jest.fn() };
    passUtil.hashPassword.mockReturnValue('hashedNewPass');
    dao.update.mockResolvedValue(true);

    await controller.postCreateOrUpdate(req, res);

    expect(passUtil.hashPassword).toHaveBeenCalledWith('newpass123');
    expect(dao.update).toHaveBeenCalledWith('user123', expect.objectContaining({
        permission: 1,
        points: 500,
        password: 'hashedNewPass'
    }));
    expect(res.redirect).toHaveBeenCalledWith('/admin.html');
});

test('postCreateOrUpdate should update user keeping existing password when txt_pass is blank', async function(){
    let req = {
        session: { user: { permission: 1 } },
        body: {
            txt_email: 'update@mail.com',
            txt_username: 'updateduser',
            id: 'user123',
            txt_pass: '   '
        }
    };
    let res = { redirect: jest.fn() };
    dao.read.mockResolvedValue({ password: 'existingHashedPass' });
    dao.update.mockResolvedValue(true);

    await controller.postCreateOrUpdate(req, res);

    expect(dao.read).toHaveBeenCalledWith('user123');
    expect(dao.update).toHaveBeenCalledWith('user123', expect.objectContaining({
        password: 'existingHashedPass'
    }));
    expect(res.redirect).toHaveBeenCalledWith('/admin.html');
});

test('postCreateOrUpdate should create new user without admin rights and redirect to index.html', async function(){
    let req = {
        session: { user: { permission: 2 } },
        body: {
            txt_email: 'brandnew@mail.com',
            txt_username: 'brandnew',
            txt_pass: 'password123'
        }
    };
    let res = { redirect: jest.fn() };
    passUtil.hashPassword.mockReturnValue('hashedPass');
    dao.create.mockResolvedValue(true);

    await controller.postCreateOrUpdate(req, res);

    expect(dao.create).toHaveBeenCalledWith(expect.objectContaining({
        permission: 2,
        password: 'hashedPass'
    }));
    expect(res.redirect).toHaveBeenCalledWith('index.html');
});

// ==========================================
// 11. Messages Controller Tests
// ==========================================
test('getUserMessages should return 401 if unauthenticated', async function(){
    let req = { session: {} };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.getUserMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
});

test('getUserMessages should return 404 if user not found', async function(){
    let req = { session: { user: 'alice' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    dao.findOne.mockResolvedValue(null);

    await controller.getUserMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
});

test('getUserMessages should return messages array on success', async function(){
    let req = { session: { user: 'alice' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    dao.findOne.mockResolvedValue({ messages: [{ text: 'Hi' }] });

    await controller.getUserMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ text: 'Hi' }]);
});

test('getUserMessages should handle errors and return 500', async function(){
    let req = { session: { user: 'alice' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    dao.findOne.mockRejectedValue(new Error('fail'));

    await controller.getUserMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Server error" });
});

test('deleteUserMessage should delete message successfully', async function(){
    let req = {
        session: { user: 'alice' },
        params: { msgId: '507f1f77bcf86cd799439011' }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    dao.update.mockResolvedValue(true);

    await controller.deleteUserMessage(req, res);

    expect(dao.update).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: "Message deleted successfully." });
});

test('deleteUserMessage should handle errors and return 500', async function(){
    let req = {
        session: { user: 'alice' },
        params: { msgId: '507f1f77bcf86cd799439011' }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    dao.update.mockRejectedValue(new Error('fail'));

    await controller.deleteUserMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Server error while deleting message." });
});

// ==========================================
// 12. Friend Chat Tests
// ==========================================
test('getFriendChat should return 401 if unauthenticated', async function(){
    let req = { params: { friendUsername: 'bob' }, session: {} };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.getFriendChat(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Not logged in." });
});

test('getFriendChat should return 400 if friendUsername is missing or blank', async function(){
    let req = {
        params: { friendUsername: '   ' },
        session: { user: { username: 'alice' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.getFriendChat(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Friend username is required." });
});

test('getFriendChat should mark incoming messages read and return sorted messages', async function(){
    let req = {
        params: { friendUsername: 'bob' },
        session: { user: { username: 'alice' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    const mockMessages = [
        { _id: 'm1', sender: 'alice', recipient: 'bob', text: 'Hey!', edited: false, deleted: false, read: true },
        { _id: 'm2', sender: 'bob', recipient: 'alice', text: 'Ready to play?', edited: false, deleted: false, read: true }
    ];

    FriendMessage.updateMany.mockResolvedValue({ modifiedCount: 1 });
    FriendMessage.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockMessages)
    });

    await controller.getFriendChat(req, res);

    expect(FriendMessage.updateMany).toHaveBeenCalledWith(
        { sender: 'bob', recipient: 'alice', read: false },
        { $set: { read: true } }
    );
    expect(FriendMessage.find).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ messages: mockMessages });
});

test('getFriendChat should return 500 when database query fails', async function(){
    let req = {
        params: { friendUsername: 'bob' },
        session: { user: { username: 'alice' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    FriendMessage.updateMany.mockRejectedValue(new Error('DB error'));

    await controller.getFriendChat(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to load messages." });
});

test('sendFriendChatMessage should return 401 if unauthenticated', async function(){
    let req = {
        params: { friendUsername: 'bob' },
        body: { text: 'Hello!' },
        session: {}
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.sendFriendChatMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Not logged in." });
});

test('sendFriendChatMessage should reject empty or whitespace-only messages with 400', async function(){
    let req = {
        params: { friendUsername: 'bob' },
        body: { text: '   ' },
        session: { user: { username: 'alice' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.sendFriendChatMessage(req, res);

    expect(FriendMessage.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Friend and message text are required." });
});

test('sendFriendChatMessage should truncate messages over 500 characters and save', async function(){
    let req = {
        params: { friendUsername: 'bob' },
        body: { text: 'a'.repeat(550) },
        session: { user: { username: 'alice' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    const createdMsg = {
        _id: 'msg500',
        sender: 'alice',
        recipient: 'bob',
        text: 'a'.repeat(500)
    };
    FriendMessage.create.mockResolvedValue(createdMsg);

    await controller.sendFriendChatMessage(req, res);

    expect(FriendMessage.create).toHaveBeenCalledWith({
        sender: 'alice',
        recipient: 'bob',
        text: 'a'.repeat(500)
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: createdMsg });
});

test('sendFriendChatMessage should create and return the new message for valid input', async function(){
    let req = {
        params: { friendUsername: 'bob' },
        body: { text: 'GG at the river!' },
        session: { user: { username: 'alice' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    const createdMsg = {
        _id: 'msg123',
        sender: 'alice',
        recipient: 'bob',
        text: 'GG at the river!',
        edited: false,
        deleted: false,
        read: false
    };
    FriendMessage.create.mockResolvedValue(createdMsg);

    await controller.sendFriendChatMessage(req, res);

    expect(FriendMessage.create).toHaveBeenCalledWith({
        sender: 'alice',
        recipient: 'bob',
        text: 'GG at the river!'
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: createdMsg });
});

test('sendFriendChatMessage should return 500 when FriendMessage.create throws', async function(){
    let req = {
        params: { friendUsername: 'bob' },
        body: { text: 'Hello!' },
        session: { user: { username: 'alice' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    FriendMessage.create.mockRejectedValue(new Error('DB write error'));

    await controller.sendFriendChatMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to send message." });
});

test('editFriendChatMessage should return 401 if unauthenticated', async function(){
    let req = {
        params: { messageId: 'msg123' },
        body: { text: 'Updated text' },
        session: {}
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.editFriendChatMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Not logged in." });
});

test('editFriendChatMessage should return 400 if updated text is empty', async function(){
    let req = {
        params: { messageId: 'msg123' },
        body: { text: '   ' },
        session: { user: { username: 'alice' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.editFriendChatMessage(req, res);

    expect(FriendMessage.findOneAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
});

test('editFriendChatMessage should return 404 when message does not exist or user is not sender', async function(){
    let req = {
        params: { messageId: 'msg123' },
        body: { text: 'Updated text' },
        session: { user: { username: 'alice' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    FriendMessage.findOneAndUpdate.mockResolvedValue(null);

    await controller.editFriendChatMessage(req, res);

    expect(FriendMessage.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'msg123', sender: 'alice', deleted: { $ne: true } },
        { text: 'Updated text', edited: true },
        { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(404);
});

test('editFriendChatMessage should update text and mark edited=true for sender', async function(){
    let req = {
        params: { messageId: 'msg123' },
        body: { text: 'Fixed typo' },
        session: { user: { username: 'alice' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    const updatedDoc = {
        _id: 'msg123',
        sender: 'alice',
        recipient: 'bob',
        text: 'Fixed typo',
        edited: true
    };
    FriendMessage.findOneAndUpdate.mockResolvedValue(updatedDoc);

    await controller.editFriendChatMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: updatedDoc });
});

test('editFriendChatMessage should return 500 when database update fails', async function(){
    let req = {
        params: { messageId: 'msg123' },
        body: { text: 'Fixed typo' },
        session: { user: { username: 'alice' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    FriendMessage.findOneAndUpdate.mockRejectedValue(new Error('DB update error'));

    await controller.editFriendChatMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to edit message." });
});

test('deleteFriendChatMessage should return 401 if unauthenticated', async function(){
    let req = { params: { messageId: 'msg123' }, session: {} };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.deleteFriendChatMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Not logged in." });
});

test('deleteFriendChatMessage should return 404 when message is missing or not owned by user', async function(){
    let req = {
        params: { messageId: 'msg123' },
        session: { user: { username: 'mallory' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    FriendMessage.findOneAndUpdate.mockResolvedValue(null);

    await controller.deleteFriendChatMessage(req, res);

    expect(FriendMessage.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'msg123', sender: 'mallory' },
        { deleted: true, text: "" },
        { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(404);
});

test('deleteFriendChatMessage should soft-delete message and clear text for sender', async function(){
    let req = {
        params: { messageId: 'msg123' },
        session: { user: { username: 'alice' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    const softDeletedDoc = {
        _id: 'msg123',
        sender: 'alice',
        recipient: 'bob',
        deleted: true,
        text: ""
    };
    FriendMessage.findOneAndUpdate.mockResolvedValue(softDeletedDoc);

    await controller.deleteFriendChatMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: softDeletedDoc });
});

test('deleteFriendChatMessage should return 500 when database delete fails', async function(){
    let req = {
        params: { messageId: 'msg123' },
        session: { user: { username: 'alice' } }
    };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    FriendMessage.findOneAndUpdate.mockRejectedValue(new Error('DB delete error'));

    await controller.deleteFriendChatMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to delete message." });
});

// ==========================================
// 13. Password Reset Tests
// ==========================================
test('requestPasswordReset should return 400 when email is missing or blank', async function(){
    let req = { body: { email: '   ' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.requestPasswordReset(req, res);

    expect(dao.findLogin).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Please enter a valid email address." });
});

test('requestPasswordReset should return 200 without updating when email does not exist', async function(){
    let req = { body: { email: 'Unknown@Mail.com' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    dao.findLogin.mockResolvedValue(null);

    await controller.requestPasswordReset(req, res);

    expect(dao.findLogin).toHaveBeenCalledWith('unknown@mail.com');
    expect(dao.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
        message: "If an account exists for that email, a 6-digit reset code has been sent."
    });
});

test('requestPasswordReset should generate a 6-digit code with 15-min expiry and update user', async function(){
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    let req = { body: { email: 'Player@Mail.com' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    dao.findLogin.mockResolvedValue({ _id: 'u123', email: 'player@mail.com' });
    dao.update.mockResolvedValue(true);

    await controller.requestPasswordReset(req, res);

    expect(dao.findLogin).toHaveBeenCalledWith('player@mail.com');
    expect(dao.update).toHaveBeenCalledWith(
        'u123',
        expect.objectContaining({
            resetCode: expect.stringMatching(/^\d{6}$/),
            resetCodeExpires: new Date(now + 15 * 60 * 1000)
        })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
        message: "If an account exists for that email, a 6-digit reset code has been sent."
    });

    Date.now.mockRestore();
});

test('requestPasswordReset should return 500 when an error occurs', async function(){
    let req = { body: { email: 'player@mail.com' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    dao.findLogin.mockRejectedValue(new Error('DB lookup error'));

    await controller.requestPasswordReset(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Could not process password reset request." });
});

test('resetPasswordWithCode should return 400 when required fields are missing', async function(){
    let req = { body: { email: 'player@mail.com', code: '', newPassword: 'secret123' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.resetPasswordWithCode(req, res);

    expect(dao.findLogin).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Email, reset code, and new password are required." });
});

test('resetPasswordWithCode should return 400 when newPassword is shorter than 6 characters', async function(){
    let req = { body: { email: 'player@mail.com', code: '123456', newPassword: '123' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.resetPasswordWithCode(req, res);

    expect(dao.findLogin).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "New password must be at least 6 characters long." });
});

test('resetPasswordWithCode should return 400 when user or reset code metadata is missing', async function(){
    let req = { body: { email: 'player@mail.com', code: '123456', newPassword: 'newpassword123' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    dao.findLogin.mockResolvedValue({ _id: 'u123', email: 'player@mail.com' });

    await controller.resetPasswordWithCode(req, res);

    expect(dao.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired reset code." });
});

test('resetPasswordWithCode should return 400 when the reset code is expired', async function(){
    let req = { body: { email: 'player@mail.com', code: '123456', newPassword: 'newpassword123' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    dao.findLogin.mockResolvedValue({
        _id: 'u123',
        email: 'player@mail.com',
        resetCode: '123456',
        resetCodeExpires: new Date(Date.now() - 60 * 1000)
    });

    await controller.resetPasswordWithCode(req, res);

    expect(dao.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired reset code." });
});

test('resetPasswordWithCode should return 400 when the reset code does not match', async function(){
    let req = { body: { email: 'player@mail.com', code: '654321', newPassword: 'newpassword123' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    dao.findLogin.mockResolvedValue({
        _id: 'u123',
        email: 'player@mail.com',
        resetCode: '123456',
        resetCodeExpires: new Date(Date.now() + 10 * 60 * 1000)
    });

    await controller.resetPasswordWithCode(req, res);

    expect(dao.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired reset code." });
});

test('resetPasswordWithCode should hash new password, clear reset fields, and return 200 on valid code', async function(){
    let req = { body: { email: ' Player@Mail.com ', code: ' 123456 ', newPassword: 'newpassword123' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    dao.findLogin.mockResolvedValue({
        _id: 'u123',
        email: 'player@mail.com',
        resetCode: '123456',
        resetCodeExpires: new Date(Date.now() + 10 * 60 * 1000)
    });
    passUtil.hashPassword.mockReturnValue('hashedNewPassword123');
    dao.update.mockResolvedValue(true);

    await controller.resetPasswordWithCode(req, res);

    expect(dao.findLogin).toHaveBeenCalledWith('player@mail.com');
    expect(passUtil.hashPassword).toHaveBeenCalledWith('newpassword123');
    expect(dao.update).toHaveBeenCalledWith('u123', {
        password: 'hashedNewPassword123',
        resetCode: null,
        resetCodeExpires: null
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
        message: "Password updated successfully. You can now log in with your new password."
    });
});

test('resetPasswordWithCode should return 500 when an unexpected error occurs', async function(){
    let req = { body: { email: 'player@mail.com', code: '123456', newPassword: 'newpassword123' } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    dao.findLogin.mockRejectedValue(new Error('DB update failure'));

    await controller.resetPasswordWithCode(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to reset password." });
});