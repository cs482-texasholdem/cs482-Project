const sponsorBannerController = require('../controller/SponsorBannerController');
const SponsorBanner = require('../model/SponsorBanner');
const userController = require('../controller/UserController');

jest.mock('../model/SponsorBanner');
jest.mock('../controller/UserController');

function createRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('SponsorBannerController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('submitBanner', () => {
        const sponsorReq = {
            session: {
                user: {
                    username: 'sponsor1',
                    sponsorCode: 'SP100',
                    sponsorName: 'Sponsor One'
                }
            },
            body: {
                headline: 'Big Tournament Tonight',
                subtext: 'Buy-in starts at $10',
                linkUrl: 'https://example.com',
                theme: 'gold'
            },
            app: {
                get: jest.fn().mockReturnValue({ emit: jest.fn() })
            }
        };

        test('rejects non-sponsors with 403', async () => {
            userController.sponsorCheck.mockReturnValue(false);
            const res = createRes();

            await sponsorBannerController.submitBanner({ body: {} }, res);
            expect(res.status).toHaveBeenCalledWith(403);
        });

        test('validates sponsorCode, headline, subtext, and linkUrl', async () => {
            userController.sponsorCheck.mockReturnValue(true);

            let res = createRes();
            await sponsorBannerController.submitBanner({ session: { user: { username: 's1' } }, body: { headline: 'Hi' } }, res);
            expect(res.status).toHaveBeenCalledWith(400);

            res = createRes();
            await sponsorBannerController.submitBanner({ ...sponsorReq, body: { headline: '   ' } }, res);
            expect(res.status).toHaveBeenCalledWith(400);

            res = createRes();
            await sponsorBannerController.submitBanner({ ...sponsorReq, body: { headline: 'a'.repeat(101) } }, res);
            expect(res.status).toHaveBeenCalledWith(400);

            res = createRes();
            await sponsorBannerController.submitBanner({ ...sponsorReq, body: { headline: 'Valid', subtext: 'b'.repeat(161) } }, res);
            expect(res.status).toHaveBeenCalledWith(400);

            res = createRes();
            await sponsorBannerController.submitBanner({ ...sponsorReq, body: { headline: 'Valid', linkUrl: 'javascript:alert(1)' } }, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test('creates a pending banner, normalizes invalid theme, and emits socket event', async () => {
            userController.sponsorCheck.mockReturnValue(true);
            const createdBanner = { _id: 'b1', headline: 'Big Tournament Tonight', status: 'pending' };
            SponsorBanner.create.mockResolvedValue(createdBanner);
            const ioEmit = jest.fn();
            const req = {
                ...sponsorReq,
                body: { ...sponsorReq.body, theme: 'invalid-theme' },
                app: { get: jest.fn().mockReturnValue({ emit: ioEmit }) }
            };
            const res = createRes();

            await sponsorBannerController.submitBanner(req, res);

            expect(SponsorBanner.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    sponsorUsername: 'sponsor1',
                    sponsorCode: 'SP100',
                    theme: 'midnight',
                    status: 'pending'
                })
            );
            expect(ioEmit).toHaveBeenCalledWith('SPONSOR_BANNERS_UPDATED');
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ banner: createdBanner });
        });

        test('updates existing banner when bannerId is provided and resets moderation fields', async () => {
            userController.sponsorCheck.mockReturnValue(true);
            const updatedBanner = { _id: 'b1', status: 'pending' };
            SponsorBanner.findOneAndUpdate.mockResolvedValue(updatedBanner);
            const res = createRes();

            await sponsorBannerController.submitBanner({
                ...sponsorReq,
                body: { ...sponsorReq.body, bannerId: 'b1' }
            }, res);

            expect(SponsorBanner.findOneAndUpdate).toHaveBeenCalledWith(
                { _id: 'b1', sponsorUsername: 'sponsor1' },
                expect.objectContaining({
                    status: 'pending',
                    moderationNote: '',
                    reviewedBy: '',
                    reviewedAt: null
                }),
                { new: true }
            );
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test('returns 404 when updating a non-existent or unowned bannerId', async () => {
            userController.sponsorCheck.mockReturnValue(true);
            SponsorBanner.findOneAndUpdate.mockResolvedValue(null);
            const res = createRes();

            await sponsorBannerController.submitBanner({
                ...sponsorReq,
                body: { ...sponsorReq.body, bannerId: 'missing-id' }
            }, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('getApprovedActiveBanners', () => {
        test('returns only approved active banners with sanitized URLs', async () => {
            const sortMock = jest.fn().mockResolvedValue([
                {
                    _id: '1',
                    sponsorName: 'Safe Sponsor',
                    sponsorCode: 'SAFE1',
                    headline: 'Welcome',
                    subtext: 'Play now',
                    linkUrl: 'https://safe.example.com',
                    theme: 'emerald',
                    durationSec: 12
                },
                {
                    _id: '2',
                    sponsorName: 'Unsafe Link',
                    sponsorCode: 'UNSF1',
                    headline: 'Click here',
                    subtext: '',
                    linkUrl: 'javascript:void(0)',
                    theme: 'midnight',
                    durationSec: 10
                }
            ]);
            const selectMock = jest.fn().mockReturnValue({ sort: sortMock });
            SponsorBanner.find.mockReturnValue({ select: selectMock });

            const res = createRes();
            await sponsorBannerController.getApprovedActiveBanners({}, res);

            expect(SponsorBanner.find).toHaveBeenCalledWith({ status: 'approved', isActive: true });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                banners: [
                    expect.objectContaining({ id: '1', linkUrl: 'https://safe.example.com/', durationSec: 12 }),
                    expect.objectContaining({ id: '2', linkUrl: '' })
                ]
            });
        });
    });

    describe('getModerationQueue & moderateBanner', () => {
        test('getModerationQueue checks admin and filters by status and code', async () => {
            userController.adminCheck.mockReturnValue(false);
            let res = createRes();
            await sponsorBannerController.getModerationQueue({ query: {} }, res);
            expect(res.status).toHaveBeenCalledWith(403);

            userController.adminCheck.mockReturnValue(true);
            const sortMock = jest.fn().mockResolvedValue([]);
            SponsorBanner.find.mockReturnValue({ sort: sortMock });
            res = createRes();

            await sponsorBannerController.getModerationQueue({
                query: { status: 'pending', code: ' vip ' }
            }, res);

            expect(SponsorBanner.find).toHaveBeenCalledWith({ status: 'pending', sponsorCode: 'VIP' });
            expect(res.status).toHaveBeenCalledWith(200);
        });

        test('moderateBanner validates status, handles 404, and approves/rejects banner', async () => {
            userController.adminCheck.mockReturnValue(true);

            let res = createRes();
            await sponsorBannerController.moderateBanner({ params: { id: 'b1' }, body: { status: 'maybe' } }, res);
            expect(res.status).toHaveBeenCalledWith(400);

            SponsorBanner.findByIdAndUpdate.mockResolvedValue(null);
            res = createRes();
            await sponsorBannerController.moderateBanner({ params: { id: 'b1' }, body: { status: 'approved' } }, res);
            expect(res.status).toHaveBeenCalledWith(404);

            const moderated = { _id: 'b1', status: 'approved' };
            SponsorBanner.findByIdAndUpdate.mockResolvedValue(moderated);
            res = createRes();
            await sponsorBannerController.moderateBanner({
                session: { user: { username: 'modAdmin' } },
                params: { id: 'b1' },
                body: { status: 'approved', moderationNote: 'Looks good' }
            }, res);

            expect(SponsorBanner.findByIdAndUpdate).toHaveBeenCalledWith(
                'b1',
                expect.objectContaining({
                    status: 'approved',
                    moderationNote: 'Looks good',
                    reviewedBy: 'modAdmin',
                    reviewedAt: expect.any(Date)
                }),
                { new: true }
            );
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });
});