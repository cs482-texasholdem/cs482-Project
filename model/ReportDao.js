const mongoose = require('mongoose');

// ==========================================
// 1. Mongoose Schema & Model
// ==========================================
const reportSchema = new mongoose.Schema({
    reporterUsername: { type: String, required: true },
    reportedUsername: { type: String, required: true },
    reason: { type: String, required: true },
    details: { type: String, maxlength: 2000 },
    resolved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);

// ==========================================
// 2. DAO Operations
// ==========================================
exports.create = async function(reportData) {
    let report = new Report(reportData);
    return await report.save();
};

exports.readAll = async function() {
    // resolved: 1 sorts false (0) before true (1), keeping unresolved reports at the top
    return await Report.find({}).sort({ resolved: 1, createdAt: -1 });
};

exports.findByIdAndUpdate = async function(id, updateData) {
    return await Report.findByIdAndUpdate(id, updateData, { new: true });
};