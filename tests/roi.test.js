/**
 * tests/roi.test.js
 * Unit tests for mapOverlayToVideoSource function.
 */

function mapOverlayToVideoSource({ videoWidth, videoHeight, displayRect, overlayRect, objectFit }) {
    let scaleX = videoWidth / displayRect.width;
    let scaleY = videoHeight / displayRect.height;
    let scale;
    
    if (objectFit === 'cover') {
        scale = Math.min(scaleX, scaleY);
    } else {
        scale = Math.max(scaleX, scaleY);
    }

    const displayedWidth = videoWidth / scale;
    const displayedHeight = videoHeight / scale;
    
    const offsetX = (displayRect.width - displayedWidth) / 2;
    const offsetY = (displayRect.height - displayedHeight) / 2;

    const roiX = overlayRect.left - displayRect.left;
    const roiY = overlayRect.top - displayRect.top;

    const sourceX = (roiX - offsetX) * scale;
    const sourceY = (roiY - offsetY) * scale;
    const sourceW = overlayRect.width * scale;
    const sourceH = overlayRect.height * scale;

    return { 
        x: Math.round(sourceX), 
        y: Math.round(sourceY), 
        w: Math.round(sourceW), 
        h: Math.round(sourceH) 
    };
}

const tests = [
    {
        name: "Landscape Video in Landscape Cover Container (Same Ratio)",
        input: {
            videoWidth: 1920, videoHeight: 1080,
            displayRect: { width: 800, height: 450, left: 0, top: 0 },
            overlayRect: { width: 400, height: 225, left: 200, top: 112.5 },
            objectFit: 'cover'
        },
        expected: { x: 480, y: 270, w: 960, h: 540 }
    },
    {
        name: "Landscape Video in Square Cover Container (Crops sides)",
        input: {
            videoWidth: 1920, videoHeight: 1080, // 16:9
            displayRect: { width: 500, height: 500, left: 0, top: 0 }, // 1:1, so height dictates scale
            overlayRect: { width: 250, height: 250, left: 125, top: 125 }, // Center 50%
            objectFit: 'cover'
        },
        // Scale = min(1920/500=3.84, 1080/500=2.16) = 2.16
        // Displayed Width = 1920 / 2.16 = 888.88
        // Displayed Height = 1080 / 2.16 = 500
        // OffsetX = (500 - 888.88)/2 = -194.44
        // ROI X = 125. Crop X = (125 - (-194.44)) * 2.16 = 319.44 * 2.16 = 690
        // Crop W = 250 * 2.16 = 540
        expected: { x: 690, y: 270, w: 540, h: 540 }
    },
    {
        name: "Portrait Video in Landscape Cover Container (Crops top/bottom)",
        input: {
            videoWidth: 1080, videoHeight: 1920, // 9:16
            displayRect: { width: 800, height: 450, left: 100, top: 100 }, // Container offset by 100,100
            overlayRect: { width: 400, height: 200, left: 300, top: 225 }, // Centered in container
            objectFit: 'cover'
        },
        // Scale = min(1080/800=1.35, 1920/450=4.26) = 1.35
        // Displayed Width = 1080 / 1.35 = 800
        // Displayed Height = 1920 / 1.35 = 1422.22
        // Offset Y = (450 - 1422.22)/2 = -486.11
        // ROI Y = 225 - 100 = 125
        // Crop Y = (125 - (-486.11)) * 1.35 = 611.11 * 1.35 = 825
        expected: { x: 270, y: 825, w: 540, h: 270 }
    }
];

let passed = 0;
tests.forEach(t => {
    const res = mapOverlayToVideoSource(t.input);
    const passX = Math.abs(res.x - t.expected.x) <= 1;
    const passY = Math.abs(res.y - t.expected.y) <= 1;
    const passW = Math.abs(res.w - t.expected.w) <= 1;
    const passH = Math.abs(res.h - t.expected.h) <= 1;
    
    if (passX && passY && passW && passH) {
        console.log(`✅ PASS: ${t.name}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${t.name}`);
        console.error(`  Expected:`, t.expected);
        console.error(`  Got:     `, res);
    }
});

console.log(`\nTests passed: ${passed}/${tests.length}`);
process.exit(passed === tests.length ? 0 : 1);
