const assert = require('node:assert/strict');
const {
    parseTurkishPlate,
    resolvePlateForForm,
    matchRegisteredPlate,
    mapOverlayToVideoSource,
    buildVerticalScanCrops,
    plateCandidateIoU,
    detectPlateCandidates,
    mapPlateCandidatesToSource,
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
    ['35 VEB OO1', '35VEB001'],
    ['35 VEB 00I', '35VEB001'],
    ['O6 A 12345', '06A12345'],
]);

for (const [input, expected] of validPlates) {
    assert.equal(parseTurkishPlate(input)?.normalized, expected);
}

for (const invalid of [
    '82ABC123',
    '34ABC1234',
    '34A123',
    '77G5Z33',
    '36A0Q348',
    '46C1S05',
    '',
    null,
]) {
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
    resolvePlateForForm('02 ABG 585', ['34EZS794', '34KM4969']),
    { normalized: '02ABG585', registered: false }
);
assert.deepEqual(
    resolvePlateForForm('34 KM 4969', ['34EZS794', '34KM4969']),
    { normalized: '34KM4969', registered: true }
);
assert.equal(resolvePlateForForm('34 E2S 794', ['34EZS794', '34KM4969']), null);
assert.equal(resolvePlateForForm('geçersiz', ['34KM4969']), null);

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

function makeSyntheticPlateFrame(width, height, plate) {
    const data = new Uint8ClampedArray(width * height * 4);

    function fillRectangle(x, y, w, h, red, green, blue) {
        const left = Math.max(0, Math.round(x));
        const top = Math.max(0, Math.round(y));
        const right = Math.min(width, Math.round(x + w));
        const bottom = Math.min(height, Math.round(y + h));

        for (let row = top; row < bottom; row += 1) {
            for (let column = left; column < right; column += 1) {
                const index = (row * width + column) * 4;
                data[index] = red;
                data[index + 1] = green;
                data[index + 2] = blue;
                data[index + 3] = 255;
            }
        }
    }

    fillRectangle(0, 0, width, height, 42, 48, 55);
    fillRectangle(25, 45, 95, 92, 225, 225, 225);
    fillRectangle(plate.x - 4, plate.y - 4, plate.w + 8, plate.h + 8, 18, 18, 18);
    fillRectangle(plate.x, plate.y, plate.w, plate.h, 236, 236, 228);
    fillRectangle(plate.x, plate.y, plate.w * 0.12, plate.h, 18, 98, 190);

    const textLeft = plate.x + plate.w * 0.17;
    const textWidth = plate.w * 0.76;
    const characterCount = 8;
    const characterGap = textWidth / characterCount;
    for (let index = 0; index < characterCount; index += 1) {
        const characterWidth = characterGap * (index % 3 === 0 ? 0.48 : 0.58);
        fillRectangle(
            textLeft + index * characterGap,
            plate.y + plate.h * 0.20,
            characterWidth,
            plate.h * 0.62,
            20,
            20,
            20
        );
    }

    return { data };
}

const syntheticPlate = { x: 190, y: 224, w: 278, h: 58 };
const syntheticFrame = makeSyntheticPlateFrame(640, 360, syntheticPlate);
const detectedCandidates = detectPlateCandidates(syntheticFrame, 640, 360);
assert.ok(detectedCandidates.length > 0, 'synthetic plate should be detected');
assert.ok(
    plateCandidateIoU(detectedCandidates[0], syntheticPlate) >= 0.45,
    `top detector candidate should overlap the plate: ${JSON.stringify(detectedCandidates[0])}`
);
assert.ok(
    detectedCandidates[0].score >= 0.54,
    `top detector candidate should trigger automatic OCR: ${detectedCandidates[0].score}`
);

const edgePlate = { x: 383, y: 297, w: 247, h: 52 };
const edgeFrame = makeSyntheticPlateFrame(640, 360, edgePlate);
const edgeCandidates = detectPlateCandidates(edgeFrame, 640, 360);
assert.ok(edgeCandidates.length > 0, 'plate near the right/bottom edge should be detected');
assert.ok(
    plateCandidateIoU(edgeCandidates[0], edgePlate) >= 0.40,
    `edge candidate should overlap the plate: ${JSON.stringify(edgeCandidates[0])}`
);

const mappedCandidate = mapPlateCandidatesToSource(
    [detectedCandidates[0]],
    {
        detectionWidth: 640,
        detectionHeight: 360,
        sourceWidth: 1920,
        sourceHeight: 1080,
    }
)[0];
assert.equal(mappedCandidate.automatic, true);
assert.ok(mappedCandidate.w > detectedCandidates[0].w * 3);
assert.ok(mappedCandidate.h > detectedCandidates[0].h * 3);

const emptyFrame = {
    data: new Uint8ClampedArray(320 * 180 * 4).fill(42),
};
for (let index = 3; index < emptyFrame.data.length; index += 4) {
    emptyFrame.data[index] = 255;
}
assert.deepEqual(detectPlateCandidates(emptyFrame, 320, 180), []);

console.log('All OCR utility tests passed.');
