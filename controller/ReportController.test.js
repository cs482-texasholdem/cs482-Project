/**
 * ============================================================================
 * File Name: ReportController.test.js
 * Author: Bonita Rodrigues
 * Purpose: Unit tests for ReportController.js using Jest mocks for Data Access Objects.
 * ============================================================================
 */

const reportController = require('../controller/ReportController');
const reportDao = require('../model/ReportDao');
const userDao = require('../model/UserDao');

// Mock Data Access Objects
jest.mock('../model/ReportDao');
jest.mock('../model/UserDao');

describe('ReportController Unit Tests', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();

        // Standard Express mock response object
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    });

    // ============================================================================
    // submitReport Tests
    // ============================================================================
    describe('submitReport()', () => {
        it('should return 401 if user session is not active', async () => {
            req = { session: {}, body: {} };

            await reportController.submitReport(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized. Please log in." });
        });

        it('should return 400 if reportedUsername or reason is missing', async () => {
            req = {
                session: { user: { username: 'reporterUser' } },
                body: { reportedUsername: '', reason: '' }
            };

            await reportController.submitReport(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "Offending username and reason are required." });
        });

        it('should return 404 if reported target user does not exist', async () => {
            req = {
                session: { user: { username: 'reporterUser' } },
                body: { reportedUsername: 'nonexistentUser', reason: 'Cheating' }
            };

            userDao.findOne.mockResolvedValue(null);

            await reportController.submitReport(req, res);

            expect(userDao.findOne).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: "The specified player does not exist." });
        });

        it('should successfully create a report when inputs are valid', async () => {
            req = {
                session: { user: { username: 'reporterUser' } },
                body: { reportedUsername: 'badPlayer', reason: 'Toxic behavior', details: 'Spamming chat' }
            };

            const mockTargetUser = { username: 'badPlayer', email: 'badplayer@example.com' };
            userDao.findOne.mockResolvedValue(mockTargetUser);
            reportDao.create.mockResolvedValue({ _id: 'report123' });

            await reportController.submitReport(req, res);

            expect(reportDao.create).toHaveBeenCalledWith(expect.objectContaining({
                reporterUsername: 'reporterUser',
                reportedUsername: 'badPlayer',
                reason: 'Toxic behavior',
                details: 'Spamming chat',
                resolved: false
            }));
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ success: true, message: "Report successfully submitted." });
        });
    });

    // ============================================================================
    // getAllReports Tests
    // ============================================================================
    describe('getAllReports()', () => {
        it('should return all reports with status 200', async () => {
            const mockReports = [
                { _id: '1', reportedUsername: 'userA', resolved: false },
                { _id: '2', reportedUsername: 'userB', resolved: true }
            ];

            reportDao.readAll.mockResolvedValue(mockReports);

            await reportController.getAllReports(req, res);

            expect(reportDao.readAll).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(mockReports);
        });

        it('should handle internal server errors gracefully', async () => {
            reportDao.readAll.mockRejectedValue(new Error('Database failure'));

            await reportController.getAllReports(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: "Server error while fetching reports." });
        });
    });

    // ============================================================================
    // resolveReport Tests
    // ============================================================================
    describe('resolveReport()', () => {
        it('should mark report as resolved and return 200', async () => {
            req = { params: { id: 'report123' } };
            reportDao.findByIdAndUpdate.mockResolvedValue({ _id: 'report123', resolved: true });

            await reportController.resolveReport(req, res);

            expect(reportDao.findByIdAndUpdate).toHaveBeenCalledWith('report123', { resolved: true });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ success: true, message: "Report marked as resolved." });
        });
    });

    // ============================================================================
    // warnUser Tests
    // ============================================================================
    describe('warnUser()', () => {
        it('should return 404 if target user is not found', async () => {
            req = { body: { username: 'missingUser' } };
            userDao.findOne.mockResolvedValue(null);

            await reportController.warnUser(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: "User not found." });
        });

        it('should initialize legacy user documents and push custom warning message', async () => {
            req = {
                body: {
                    reportId: 'rep1',
                    username: 'legacyUser',
                    warningMessage: 'Stop spamming the table chat!'
                }
            };

            // Legacy user object missing warnings & messages array
            const mockLegacyUser = {
                username: 'legacyUser',
                save: jest.fn().mockResolvedValue(true),
                markModified: jest.fn()
            };

            userDao.findOne.mockResolvedValue(mockLegacyUser);
            reportDao.findByIdAndUpdate.mockResolvedValue(true);

            await reportController.warnUser(req, res);

            expect(mockLegacyUser.warnings).toBe(1);
            expect(mockLegacyUser.messages).toHaveLength(1);
            expect(mockLegacyUser.messages[0]).toEqual(expect.objectContaining({
                sender: 'System Administrator',
                text: 'Stop spamming the table chat!'
            }));
            expect(mockLegacyUser.markModified).toHaveBeenCalledWith('warnings');
            expect(mockLegacyUser.markModified).toHaveBeenCalledWith('messages');
            expect(mockLegacyUser.save).toHaveBeenCalled();
            expect(reportDao.findByIdAndUpdate).toHaveBeenCalledWith('rep1', { resolved: true });

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Warning issued successfully. User now has 1 warning(s).",
                warnings: 1
            });
        });

        it('should increment warning count and use fallback warning message if none provided', async () => {
            req = {
                body: {
                    username: 'existingUser',
                    warningMessage: ''
                }
            };

            const mockUser = {
                username: 'existingUser',
                warnings: 2,
                messages: [{ sender: 'Admin', text: 'Prev msg' }],
                save: jest.fn().mockResolvedValue(true),
                markModified: jest.fn()
            };

            userDao.findOne.mockResolvedValue(mockUser);

            await reportController.warnUser(req, res);

            expect(mockUser.warnings).toBe(3);
            expect(mockUser.messages).toHaveLength(2);
            expect(mockUser.messages[1].text).toContain('Official Warning #3');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Warning issued successfully. User now has 3 warning(s).",
                warnings: 3
            });
        });
    });
});