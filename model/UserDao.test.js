const dbcon = require('./DbConnection');
const dao = require('./UserDao');

beforeAll(async function(){
    await dbcon.connect("test");
});

afterAll(async function(){
    await dao.deleteAll();
    await dbcon.disconnect();
});

beforeEach(async function(){
    await dao.deleteAll();
});

// ==========================================
// 1. readAll Tests
// ==========================================
test('readAll should return an empty array when database is empty', async function(){
    let users = await dao.readAll();
    expect(users.length).toBe(0);
});

// ==========================================
// 2. create Tests
// ==========================================
test('create should successfully insert a new user and return the record with an ID', async function(){
    let newUserData = {
        login: 'testplayer@poker.com',
        password: 'hashedPassword123',
        permission: 2,
        points: 1000
    };

    let createdUser = await dao.create(newUserData);
    let users = await dao.readAll();

    expect(users.length).toBe(1);
    expect(createdUser._id).toBeDefined();
    expect(createdUser.login).toBe('testplayer@poker.com');
    expect(createdUser.points).toBe(1000);
});

// ==========================================
// 3. read Tests
// ==========================================
test('read should find and return a specific user by their ID', async function(){
    let newUserData = {
        login: 'readuser@poker.com',
        password: 'password123',
        permission: 2
    };

    let created = await dao.create(newUserData);
    let foundUser = await dao.read(created._id);

    expect(foundUser).not.toBeNull();
    expect(foundUser.login).toBe('readuser@poker.com');
    expect(foundUser._id.toString()).toBe(created._id.toString());
});

// ==========================================
// 4. findLogin Tests
// ==========================================
test('findLogin should locate a user document by login/email string', async function(){
    let newUserData = {
        login: 'admin@poker.com',
        password: 'adminPassword',
        permission: 1
    };

    await dao.create(newUserData);
    let foundUser = await dao.findLogin('admin@poker.com');

    expect(foundUser).not.toBeNull();
    expect(foundUser.permission).toBe(1);
    expect(foundUser.login).toBe('admin@poker.com');
});

// ==========================================
// 5. update Tests
// ==========================================
test('update should modify user fields like points and permission correctly', async function(){
    let newUserData = {
        login: 'updateuser@poker.com',
        password: 'password123',
        points: 500
    };

    let created = await dao.create(newUserData);
    
    let updatedUser = await dao.update(created._id, { points: 5000, permission: 1 });

    expect(updatedUser.points).toBe(5000);
    expect(updatedUser.permission).toBe(1);
    expect(updatedUser.login).toBe('updateuser@poker.com');
});

// ==========================================
// 6. del Tests
// ==========================================
test('del should remove a user record from the database by ID', async function(){
    let newUserData = {
        login: 'deleteuser@poker.com',
        password: 'password123'
    };

    let created = await dao.create(newUserData);
    let usersBefore = await dao.readAll();
    expect(usersBefore.length).toBe(1);

    await dao.del(created._id);
    let usersAfter = await dao.readAll();
    expect(usersAfter.length).toBe(0);
});