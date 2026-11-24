describe('DbConnection', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {
            ...originalEnv,
            DB_URI: 'mongodb://localhost:27017/prod',
            TESTDB_URI: 'mongodb://localhost:27017/test'
        };
        delete process.env.CI;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('connects to TESTDB_URI when where is "test"', async () => {
        const connectMock = jest.fn().mockResolvedValue();
        jest.doMock('mongoose', () => ({
            connect: connectMock,
            connection: { close: jest.fn().mockResolvedValue() }
        }));

        const dbConnection = require('./DbConnection');
        await dbConnection.connect('test');

        expect(connectMock).toHaveBeenCalledWith('mongodb://localhost:27017/test');
    });

    test('connects to CI URI when process.env.CI is truthy', async () => {
        process.env.CI = 'true';
        const connectMock = jest.fn().mockResolvedValue();
        jest.doMock('mongoose', () => ({
            connect: connectMock,
            connection: { close: jest.fn().mockResolvedValue() }
        }));

        const dbConnection = require('./DbConnection');
        await dbConnection.connect('test');

        expect(connectMock).toHaveBeenCalledWith('mongodb://adm:secret@localhost:27017');
    });

    test('connects to DB_URI by default', async () => {
        const connectMock = jest.fn().mockResolvedValue();
        jest.doMock('mongoose', () => ({
            connect: connectMock,
            connection: { close: jest.fn().mockResolvedValue() }
        }));

        const dbConnection = require('./DbConnection');
        await dbConnection.connect();

        expect(connectMock).toHaveBeenCalledWith('mongodb://localhost:27017/prod');
    });

    test('logs error and rethrows when mongoose.connect fails', async () => {
        const err = new Error('connect failed');
        const connectMock = jest.fn().mockRejectedValue(err);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.doMock('mongoose', () => ({
            connect: connectMock,
            connection: { close: jest.fn().mockResolvedValue() }
        }));

        const dbConnection = require('./DbConnection');

        await expect(dbConnection.connect('test')).rejects.toThrow('connect failed');
        expect(errorSpy).toHaveBeenCalledWith('Database connection error:', err);

        errorSpy.mockRestore();
    });

    test('disconnect closes mongoose connection', async () => {
        const closeMock = jest.fn().mockResolvedValue();
        jest.doMock('mongoose', () => ({
            connect: jest.fn(),
            connection: { close: closeMock }
        }));

        const dbConnection = require('./DbConnection');
        await dbConnection.disconnect();

        expect(closeMock).toHaveBeenCalled();
    });
});