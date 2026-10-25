const controller = require('./UserController');
const dao = require('../model/UserDao');
const passUtil = require('../util/PasswordUtil');

jest.mock('../model/UserDao');
jest.mock('../util/PasswordUtil');

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
    dao.readAll.mockResolvedValue([{ login: 'adminUser' }]);

    await controller.getAll(req, res);

    expect(dao.readAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([{ login: 'adminUser' }]);
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
        body: { txt_login: 'newplayer', txt_email: 'newplayer@mail.com', txt_pass: 'secure123' },
        session: {}
    };
    let res = { redirect: jest.fn() };
    passUtil.hashPassword.mockReturnValue('hashedPassword');
    dao.create.mockResolvedValue({ _id: '1' });

    await controller.register(req, res);

    expect(passUtil.hashPassword).toHaveBeenCalledWith('secure123');
    expect(dao.create).toHaveBeenCalled();
    expect(req.session.user).toEqual({
        login: 'newplayer',
        email: 'newplayer@mail.com',
        permission: 2,
        points: 1000
    });
    expect(res.redirect).toHaveBeenCalledWith('/index.html');
});

test('register should catch database errors and redirect to signup.html', async function(){
    let req = {
        body: { txt_login: 'erroruser' },
        session: {}
    };
    let res = { redirect: jest.fn() };
    dao.create.mockRejectedValue(new Error('DB connection failed'));

    await controller.register(req, res);

    expect(res.redirect).toHaveBeenCalledWith('/signup.html');
});

// ==========================================
// 5. login Tests
// ==========================================
test('login should redirect with error=1 when user does not exist', async function(){
    let req = { body: { txt_login: 'nonexistent' } };
    let res = { redirect: jest.fn() };
    dao.findLogin.mockResolvedValue(null);

    await controller.login(req, res);

    expect(res.redirect).toHaveBeenCalledWith('login.html?error=1');
});

test('login should succeed and redirect admin to admin.html', async function(){
    let req = { body: { txt_login: 'admin', txt_pass: 'correct' }, session: {} };
    let res = { redirect: jest.fn() };
    let adminUser = { login: 'admin', password: 'hashed', permission: 1 };
    
    dao.findLogin.mockResolvedValue(adminUser);
    passUtil.comparePassword.mockReturnValue(true);

    await controller.login(req, res);

    expect(req.session.user).toEqual(adminUser);
    expect(res.redirect).toHaveBeenCalledWith('admin.html');
});

test('login should succeed and redirect standard player to index.html', async function(){
    let req = { body: { txt_login: 'player', txt_pass: 'correct' }, session: {} };
    let res = { redirect: jest.fn() };
    let playerUser = { login: 'player', password: 'hashed', permission: 2 };
    
    dao.findLogin.mockResolvedValue(playerUser);
    passUtil.comparePassword.mockReturnValue(true);

    await controller.login(req, res);

    expect(req.session.user).toEqual(playerUser);
    expect(res.redirect).toHaveBeenCalledWith('index.html');
});

test('login should fail and redirect with error=1 when password check fails', async function(){
    let req = { body: { txt_login: 'admin', txt_pass: 'wrong' } };
    let res = { redirect: jest.fn() };
    dao.findLogin.mockResolvedValue({ password: 'hashed' });
    passUtil.comparePassword.mockReturnValue(false);

    await controller.login(req, res);

    expect(res.redirect).toHaveBeenCalledWith('login.html?error=1');
});

// ==========================================
// 6. loggedUser & logout Tests
// ==========================================
test('loggedUser should send active session user with status 200', function(){
    let req = { session: { user: { login: 'activeUser' } } };
    let res = {
        status: jest.fn(),
        send: jest.fn(),
        end: jest.fn()
    };

    controller.loggedUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(req.session.user);
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

test('logout should clear session user and redirect to index.html', function(){
    let req = { session: { user: { login: 'activeUser' } } };
    let res = { redirect: jest.fn() };

    controller.logout(req, res);

    expect(req.session.user).toBeNull();
    expect(res.redirect).toHaveBeenCalledWith('index.html');
});

// ==========================================
// 8. Social & Friend System Tests
// ==========================================
test('searchUsers should query DAO and return matching usernames as JSON', async function(){
    let req = {
        query: { q: 'bub' },
        session: { user: { login: 'alice@mail.com', username: 'alice' } }
    };
    let res = {
        json: jest.fn()
    };
    dao.find.mockResolvedValue([{ username: 'bubbles', login: 'bubbles@mail.com' }]);

    await controller.searchUsers(req, res);

    expect(dao.find).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([{ username: 'bubbles' }]);
});

test('sendFriendRequest should push sender username into recipient friendRequests and redirect', async function(){
    let req = {
        body: { targetUser: 'bubbles' },
        session: { user: { login: 'alice@mail.com', username: 'alice' } }
    };
    let res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
    };
    
    // 1st findOne: lookup sender, 2nd findOne: lookup recipient
    dao.findOne
        .mockResolvedValueOnce({ username: 'alice', login: 'alice@mail.com' })
        .mockResolvedValueOnce({ username: 'bubbles', login: 'bubbles@mail.com' });
    dao.update.mockResolvedValue(true);

    await controller.sendFriendRequest(req, res);

    expect(dao.update).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/index.html');
});

test('getFriendsData should return resolved friends and requests JSON', async function(){
    let req = {
        session: { user: { login: 'alice@mail.com', username: 'alice' } }
    };
    let res = {
        json: jest.fn()
    };

    // 1st findOne: get logged-in user, 2nd findOne: resolve 'bob', 3rd findOne: resolve 'charlie'
    dao.findOne
        .mockResolvedValueOnce({
            username: 'alice',
            friends: ['bob'],
            friendRequests: ['charlie']
        })
        .mockResolvedValueOnce({ username: 'bob' })
        .mockResolvedValueOnce({ username: 'charlie' });

    await controller.getFriendsData(req, res);

    expect(res.json).toHaveBeenCalledWith({
        friends: ['bob'],
        friendRequests: ['charlie']
    });
});

test('acceptFriendRequest should move requester from requests to friends and update both users', async function(){
    let req = {
        body: { requester: 'charlie' },
        session: { user: { login: 'alice@mail.com', username: 'alice' } }
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
        session: { user: { login: 'alice@mail.com', username: 'alice' } }
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
        session: { user: { login: 'alice@mail.com', username: 'alice' } }
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
        session: { user: { login: 'alice@mail.com', username: 'alice' } }
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
    let req = { session: { user: { login: 'alice@mail.com', username: 'alice' } } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    dao.findOne.mockResolvedValue(null);

    await controller.getFriendsData(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
});

test('getFriendsData should catch errors and return 500 status', async function(){
    let req = { session: { user: { login: 'alice@mail.com', username: 'alice' } } };
    let res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
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
        session: { user: { login: 'alice@mail.com', username: 'alice' } }
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
        session: { user: { login: 'alice@mail.com', username: 'alice' } }
    };
    let res = { redirect: jest.fn() };
    dao.update.mockRejectedValue(new Error('DB error'));

    await controller.declineFriendRequest(req, res);

    expect(res.redirect).toHaveBeenCalledWith('/index.html');
});