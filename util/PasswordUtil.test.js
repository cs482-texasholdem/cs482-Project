const passutil = require('./PasswordUtil');

test('Hashing & Comparing password',async function(){
    let strpwd = "123456";
    let str2 = "12345"
    let hashedpwd = passutil.hashPassword(strpwd);
    let same1 = passutil.comparePassword(strpwd, hashedpwd);
    let same2 = passutil.comparePassword(str2, hashedpwd);

    expect(hashedpwd).not.toBeNull();
    expect(hashedpwd).not.toEqual(strpwd);
    expect(same1).toBeTruthy();
    expect(same2).toBeFalsy();
});