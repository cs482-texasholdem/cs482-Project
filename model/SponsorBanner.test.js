const mongoose = require('mongoose');
const SponsorBanner = require('../model/SponsorBanner');

describe('SponsorBanner Model', () => {
    const validPayload = {
        sponsorUsername: '  acmesponsor  ',
        sponsorCode: '  acme2026  ',
        sponsorName: '  Acme Poker Club  ',
        headline: '  Weekly High Roller Freeroll  ',
        subtext: '  Join every Friday at 8 PM EST  ',
        linkUrl: '  https://example.com/freeroll  '
    };

    test('applies defaults, trims strings, and uppercases sponsorCode', () => {
        const doc = new SponsorBanner(validPayload);
        const err = doc.validateSync();

        expect(err).toBeUndefined();
        expect(doc.sponsorUsername).toBe('acmesponsor');
        expect(doc.sponsorCode).toBe('ACME2026');
        expect(doc.sponsorName).toBe('Acme Poker Club');
        expect(doc.headline).toBe('Weekly High Roller Freeroll');
        expect(doc.theme).toBe('midnight');
        expect(doc.durationSec).toBe(20);
        expect(doc.isActive).toBe(true);
        expect(doc.status).toBe('pending');
        expect(doc.moderationNote).toBe('');
        expect(doc.reviewedBy).toBe('');
        expect(doc.reviewedAt).toBeNull();
    });

    test('fails validation when required fields are missing', () => {
        const doc = new SponsorBanner({});
        const err = doc.validateSync();

        expect(err.errors.sponsorUsername).toBeDefined();
        expect(err.errors.sponsorName).toBeDefined();
        expect(err.errors.headline).toBeDefined();
    });

    test('enforces sponsorCode min and max length', () => {
        const shortCode = new SponsorBanner({ ...validPayload, sponsorCode: 'ABC' });
        expect(shortCode.validateSync().errors.sponsorCode).toBeDefined();

        const longCode = new SponsorBanner({ ...validPayload, sponsorCode: 'A'.repeat(41) });
        expect(longCode.validateSync().errors.sponsorCode).toBeDefined();
    });

    test('enforces field max lengths', () => {
        expect(new SponsorBanner({ ...validPayload, headline: 'x'.repeat(101) }).validateSync().errors.headline).toBeDefined();
        expect(new SponsorBanner({ ...validPayload, subtext: 'x'.repeat(161) }).validateSync().errors.subtext).toBeDefined();
        expect(new SponsorBanner({ ...validPayload, sponsorName: 'x'.repeat(81) }).validateSync().errors.sponsorName).toBeDefined();
        expect(new SponsorBanner({ ...validPayload, linkUrl: 'x'.repeat(501) }).validateSync().errors.linkUrl).toBeDefined();
        expect(new SponsorBanner({ ...validPayload, moderationNote: 'x'.repeat(241) }).validateSync().errors.moderationNote).toBeDefined();
    });

    test('enforces theme and status enums and durationSec bounds', () => {
        expect(new SponsorBanner({ ...validPayload, theme: 'neon' }).validateSync().errors.theme).toBeDefined();
        expect(new SponsorBanner({ ...validPayload, status: 'archived' }).validateSync().errors.status).toBeDefined();
        expect(new SponsorBanner({ ...validPayload, durationSec: 4 }).validateSync().errors.durationSec).toBeDefined();
        expect(new SponsorBanner({ ...validPayload, durationSec: 31 }).validateSync().errors.durationSec).toBeDefined();
    });
});