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
test('register should create user, set session, and redirect to index.html on success', async function(){
    let req = {
        body: { txt_login: 'newplayer', txt_pass: 'secure123' },
        session: {}
    };
    let res = { redirect: jest.fn() };
    passUtil.hashPassword.mockReturnValue('hashedPassword');
    dao.create.mockResolvedValue({ _id: '1' });

    await controller.register(req, res);

    expect(passUtil.hashPassword).toHaveBeenCalledWith('secure123');
    expect(dao.create).toHaveBeenCalled();
    expect(req.session.user).toBe('newplayer');
    expect(req.session.permission).toBe(2);
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
// 7. postCreateOrUpdate Tests
// ==========================================
test('postCreateOrUpdate should insert new user when no ID is provided', async function(){
    let req = {
        body: { txt_login: 'newbie', txt_pass: 'pass123' },
        session: { user: { permission: 2 } }
    };
    let res = { redirect: jest.fn() };
    passUtil.hashPassword.mockReturnValue('hashed');
    dao.create.mockResolvedValue(true);

    await controller.postCreateOrUpdate(req, res);

    expect(dao.create).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('index.html');
});

test('postCreateOrUpdate should update existing user when ID is provided', async function(){
    let req = {
        body: { txt_login: 'existingUser', txt_pass: 'newPass123', id: '651234abcde' },
        session: { user: { permission: 2 } }
    };
    let res = { redirect: jest.fn() };
    passUtil.hashPassword.mockReturnValue('hashed');
    dao.update.mockResolvedValue(true);

    await controller.postCreateOrUpdate(req, res);

    expect(dao.update).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('index.html');
});