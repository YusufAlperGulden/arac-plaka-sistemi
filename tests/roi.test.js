const assert = require('node:assert/strict');
const {
    parseTurkishPlate,
    matchRegisteredPlate,
    mapOverlayToVideoSource,
    buildVerticalScanCrops,
} = require('../static/js/ocr-utils.js');

function assertRect(actual, expected, tolerance = 1) {
    for (const key of ['x', 'y', 'w', 'h']) {
        assert.ok(
            Math.abs(actual[key] - expected[key]) <= tolerance,
            `${key}: expected ${expected[key]}, got ${actual[key]}`
        );
    }
}

const roiCases = [
    {
        name: 'same-ratio cover',
        input: {
            videoWidth: 1920,
            videoHeight: 1080,
            displayRect: { width: 800, height: 450, left: 0, top: 0 },
            overlayRect: { width: 400, height: 225, left: 200, top: 112.5 },
            objectFit: 'cover',
            objectPosition: '50% 50%',
        },
        expected: { x: 480, y: 270, w: 960, h: 540 },
    },
    {
        name: 'landscape video in square cover',
        input: {
            videoWidth: 1920,
            videoHeight: 1080,
            displayRect: { width: 500, height: 500, left: 0, top: 0 },
            overlayRect: { width: 250, height: 250, left: 125, top: 125 },
            objectFit: 'cover',
            objectPosition: '50% 50%',
        },
        expected: { x: 690, y: 270, w: 540, h: 540 },
    },
    {
        name: 'portrait video in landscape cover',
        input: {
            videoWidth: 1080,
            videoHeight: 1920,
            displayRect: { width: 800, height: 450, left: 100, top: 100 },
            overlayRect: { width: 400, height: 200, left: 300, top: 225 },
            objectFit: 'cover',
            objectPosition: '50% 50%',
        },
        expected: { x: 270, y: 825, w: 540, h: 270 },
    },
    {
        name: 'left-top object position',
        input: {
            videoWidth: 1920,
            videoHeight: 1080,
            displayRect: { width: 500, height: 500, left: 0, top: 0 },
            overlayRect: { width: 250, height: 250, left: 0, top: 0 },
            objectFit: 'cover',
            objectPosition: 'left top',
        },
        expected: { x: 0, y: 0, w: 540, h: 540 },
    },
    {
        name: 'contain with letterboxing',
        input: {
            videoWidth: 1920,
            videoHeight: 1080,
            displayRect: { width: 500, height: 500, left: 0, top: 0 },
            overlayRect: { width: 250, height: 150, left: 125, top: 175 },
            objectFit: 'contain',
            objectPosition: '50% 50%',
        },
        expected: { x: 480, y: 252, w: 960, h: 576 },
    },
];

for (const testCase of roiCases) {
    assertRect(mapOverlayToVideoSource(testCase.input), testCase.expected);
    console.log(`PASS ROI: ${testCase.name}`);
}

assert.throws(
    () => mapOverlayToVideoSource({
        videoWidth: 1920,
        videoHeight: 1080,
        displayRect: { width: 500, height: 500, left: 0, top: 0 },
        overlayRect: { width: 250, height: 250, left: -250, top: 125 },
        objectFit: 'cover',
        objectPosition: '50% 50%',
    }),
    /hizalanmadı/
);

const validPlates = new Map([
    ['34 KM 4969', '34KM4969'],
    ['06-A-12345', '06A12345'],
    ['34 ABC 12', '34ABC12'],
    ['Plaka: 34 EZS 794', '34EZS794'],
    ['H02ABG585', '02ABG585'],
    ['102 ABG585', '02ABG585'],
]);

for (const [input, expected] of validPlates) {
    assert.equal(parseTurkishPlate(input)?.normalized, expected);
}

for (const invalid of ['82ABC123', '34ABC1234', '34A123', '', null]) {
    assert.equal(parseTurkishPlate(invalid), null);
}

assert.deepEqual(
    matchRegisteredPlate('34 E2S 794', ['34EZS794', '34KM4969']),
    { normalized: '34EZS794', corrected: true }
);
assert.deepEqual(
    matchRegisteredPlate('34 KM 49G9', ['34EZS794', '34KM4969']),
    { normalized: '34KM4969', corrected: true }
);
assert.equal(matchRegisteredPlate('34ABC123', ['34EZS794', '34KM4969']), null);

assert.deepEqual(
    buildVerticalScanCrops(
        { x: 203, y: 817, w: 538, h: 134 },
        1159,
    ),
    [
        { x: 203, y: 817, w: 538, h: 134, offset: 0 },
        { x: 203, y: 750, w: 538, h: 134, offset: -0.5 },
        { x: 203, y: 884, w: 538, h: 134, offset: 0.5 },
    ]
);

assert.deepEqual(
    buildVerticalScanCrops(
        { x: 10, y: 0, w: 100, h: 80 },
        100,
        [0, -0.5, 0.5, 2],
    ),
    [
        { x: 10, y: 0, w: 100, h: 80, offset: 0 },
        { x: 10, y: 20, w: 100, h: 80, offset: 0.5 },
    ]
);

console.log('All OCR utility tests passed.');
