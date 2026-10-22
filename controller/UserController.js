const dao = require('../model/UserDao');
const passUtil = require('../util/PasswordUtil');


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


exports.postCreateOrUpdate = async function(req, res){
    let userData = {};
    userData.login = req.body.txt_login;

    // Check permissions
    if(exports.adminCheck(req) === true && req.body.txt_perm){  
        userData.permission = parseInt(req.body.txt_perm);
    } else { 
        userData.permission = 2; // Default to common user permission
    }

    // Capture points/chips if provided
    if(req.body.txt_points) {
        userData.points = parseInt(req.body.txt_points); // or userData.chips depending on your schema
    }

    // Check for ID (supporting txt_id, id, or _id)
    let userId = req.body.txt_id || req.body.id;

    if(userId){
        // --- UPDATE USER ---
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
        // --- INSERT NEW USER ---
        if(req.body.txt_pass) {
            userData.password = passUtil.hashPassword(req.body.txt_pass);
        }
        await dao.create(userData);        
    }

    if(exports.adminCheck(req) === true)
        res.redirect("/admin.html");
    else 
        res.redirect('index.html');
}


exports.register = async function(req, res){
    try {
        let userData = {};
        userData.login = req.body.txt_login;
        userData.permission = 2; // New signups are always standard players
        userData.points = 1000; // Starting chip stack

        if(req.body.txt_pass) {
            userData.password = passUtil.hashPassword(req.body.txt_pass);
        }

        // Save new user to MongoDB Atlas
        await dao.create(userData);

        // Automatically log them in or redirect them straight to home
        req.session.user = userData.login;
        req.session.permission = 2;

        res.redirect('/index.html');
    } catch (error) {
        console.error("Error during user registration:", error);
        res.redirect('/signup.html');
    }
};


exports.login = async function(req, res){
    let plogin = req.body.txt_login;
    let user = await dao.findLogin(plogin);

    if(user == null){ 
        res.redirect('login.html?error=1');
    } else {
        if(passUtil.comparePassword(req.body.txt_pass, user.password)){
            console.log("Login successful");
            req.session.user = user;

            // check for admin
            if(exports.adminCheck(req)){
                res.redirect('admin.html'); // or whatever your admin page is named
            } else {
                res.redirect('index.html');
            }
            // ---------------------------
        }
        else{ 
            res.redirect('login.html?error=1');
        }
    } 
}


exports.loggedUser = function(req, res){
    res.status(200); 
    if(req.session.user) 
        res.send(req.session.user); 
    else 
        res.json(null); // res.json() required for null values
    res.end(); 
}


exports.logout = function(req, res){
    req.session.user = null; 
    res.redirect('index.html');
}


exports.adminCheck = function(req){ 
    return (req.session.user && req.session.user.permission == 1);
}