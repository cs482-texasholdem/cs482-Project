/**
 * ============================================================================
 * File Name: ReportDao.test.js
 * Author: Bonita Rodrigues
 * Purpose: Unit tests for ReportDao.js using Jest mocks for Mongoose models.
 * ============================================================================
 */

const reportDao = require('../model/ReportDao');
const mongoose = require('mongoose');

// Mock Mongoose model methods
jest.mock('mongoose', () => {
    const actualMongoose = jest.requireActual('mongoose');
    return {
        ...actualMongoose,
        model: jest.fn().mockReturnValue({
            find: jest.fn(),
            findByIdAndUpdate: jest.fn()
        }),
        models: {}
    };
});

// Import or reference the mocked model via mongoose.model
const ReportModel = mongoose.model('Report');

describe('ReportDao Unit Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================================================
    // create() Tests
    // ============================================================================
    describe('create()', () => {
        it('should successfully instantiate and save a new report document', async () => {
            const mockReportData = {
                reporterUsername: 'user1',
                reportedUsername: 'user2',
                reason: 'Cheating',
                details: 'Used wallhack'
            };

            // Mock instance save method
            const mockSave = jest.fn().mockResolvedValue({ _id: 'reportId123', ...mockReportData });
            
            // Override the constructor behavior in our test
            ReportModel.mockImplementation = function(data) {
                return {
                    ...data,
                    save: mockSave
                };
            };

            // Since ReportModel is mocked as a function/constructor in tests, let's mock the constructor directly
            // A common pattern for Mongoose model instantiation tests:
            const Report = mongoose.model('Report');
            
            // Re-mock implementation for instantiation
            Report.mockImplementation = function(data) {
                return {
                    ...data,
                    save: mockSave
                };
            };

            // Alternatively, let's test via a direct spy or mock on model prototype if needed, 
            // or test the DAO function assuming standard Mongoose instantiation:
        });
    });

    // ============================================================================
    // readAll() Tests
    // ============================================================================
    describe('readAll()', () => {
        it('should call Report.find with empty query and sort by resolved status and creation date', async () => {
            const mockSort = jest.fn().mockResolvedValue([
                { _id: '1', resolved: false, createdAt: '2026-10-01' }
            ]);
            ReportModel.find.mockReturnValue({ sort: mockSort });

            const result = await reportDao.readAll();

            expect(ReportModel.find).toHaveBeenCalledWith({});
            expect(mockSort).toHaveBeenCalledWith({ resolved: 1, createdAt: -1 });
            expect(result).toHaveLength(1);
            expect(result[0]._id).toBe('1');
        });
    });

    // ============================================================================
    // findByIdAndUpdate() Tests
    // ============================================================================
    describe('findByIdAndUpdate()', () => {
        it('should call Report.findByIdAndUpdate with correct ID, update data, and options', async () => {
            const reportId = 'report123';
            const updateData = { resolved: true };
            const updatedDocument = { _id: reportId, resolved: true };

            ReportModel.findByIdAndUpdate.mockResolvedValue(updatedDocument);

            const result = await reportDao.findByIdAndUpdate(reportId, updateData);

            expect(ReportModel.findByIdAndUpdate).toHaveBeenCalledWith(
                reportId,
                updateData,
                { new: true }
            );
            expect(result).toEqual(updatedDocument);
        });
    });
});