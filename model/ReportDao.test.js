/**
 * ============================================================================
 * File Name: ReportDao.test.js
 * Author: Bonita Rodrigues, Gigi Li
 * Purpose: Unit tests for ReportDao.js using Jest mocks for Mongoose models.
 * ============================================================================
 */

const reportDao = require('../model/ReportDao');
const mongoose = require('mongoose');

jest.mock('mongoose', () => {
    const actualMongoose = jest.requireActual('mongoose');
    const mockReportModel = jest.fn();
    mockReportModel.find = jest.fn();
    mockReportModel.findByIdAndUpdate = jest.fn();

    return {
        ...actualMongoose,
        model: jest.fn(() => mockReportModel),
        models: {}
    };
});

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
            const savedReport = { _id: 'reportId123', ...mockReportData, resolved: false };
            const mockSave = jest.fn().mockResolvedValue(savedReport);

            ReportModel.mockImplementationOnce(function () {
                return { save: mockSave };
            });

            const result = await reportDao.create(mockReportData);

            expect(ReportModel).toHaveBeenCalledWith(mockReportData);
            expect(mockSave).toHaveBeenCalledTimes(1);
            expect(result).toEqual(savedReport);
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
                { returnDocument: 'after' }
            );
            expect(result).toEqual(updatedDocument);
        });
    });
});