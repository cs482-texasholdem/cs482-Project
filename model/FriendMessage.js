const mongoose = require("mongoose");

const friendMessageSchema = new mongoose.Schema(
    {
        sender: {type: String, required: true, trim: true, index: true},
        recipient: {type: String, required: true, trim: true, index: true},
        text: {type: String, required: true, trim: true, maxlength: 500},
        edited: {type: Boolean, default: false},
        deleted: {type: Boolean, default: false}
    },
    { timestamps: true }
);

module.exports = mongoose.model("FriendMessage", friendMessageSchema);