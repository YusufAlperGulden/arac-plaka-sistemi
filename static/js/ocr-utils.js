(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.PlateOcrUtils = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const OCR_CONFUSION_GROUPS = [
        new Set(['0', 'O', 'Q']),
        new Set(['1', 'I', 'L']),
        new Set(['2', 'Z']),
        new Set(['5', 'S']),
        new Set(['6', 'G']),
        new Set(['8', 'B']),
    ];

    function normalizeCharacters(value) {
        return String(value || '')
            .toUpperCase()
            .replace(/İ/g, 'I')
            .replace(/Ş/g, 'S');
    }

    function buildPlate(provinceText, letters, digits) {
        const provinceCode = Number(provinceText);
        const validDigitCounts = {
            1: new Set([4, 5]),
            2: new Set([3, 4]),
            3: new Set([2, 3]),
        };

        if (!Number.isInteger(provinceCode) || provinceCode < 1 || provinceCode > 81) {
            return null;
        }

        if (!validDigitCounts[letters.length]?.has(digits.length)) {
            return null;
        }

        return {
            normalized: provinceText + letters + digits,
            provinceCode,
            letters,
            digits,
        };
    }

    function parseTurkishPlate(value) {
        if (typeof value !== 'string' || !value.trim()) {
            return null;
        }

        const source = normalizeCharacters(value);
        const separatedPattern = /(?:^|[^A-Z0-9])(\d{2})[\s\-_.]*([A-Z]{1,3})[\s\-_.]*(\d{2,5})(?=$|[^A-Z0-9])/g;
        let match;

        while ((match = separatedPattern.exec(source)) !== null) {
            const parsed = buildPlate(match[1], match[2], match[3]);
            if (parsed) {
                return parsed;
            }
        }

        const compact = source.replace(/[^A-Z0-9]/g, '');
        const compactMatch = /^(\d{2})([A-Z]{1,3})(\d{2,5})$/.exec(compact);
        return compactMatch
            ? buildPlate(compactMatch[1], compactMatch[2], compactMatch[3])
            : null;
    }

    function charactersAreOcrEquivalent(left, right) {
        if (left === right) {
            return true;
        }
        return OCR_CONFUSION_GROUPS.some(group => group.has(left) && group.has(right));
    }

    function isConfusionOnlyMatch(observed, expected) {
        if (observed.length !== expected.length) {
            return false;
        }

        let substitutions = 0;
        for (let index = 0; index < expected.length; index += 1) {
            if (observed[index] === expected[index]) {
                continue;
            }
            if (!charactersAreOcrEquivalent(observed[index], expected[index])) {
                return false;
            }
            substitutions += 1;
        }

        return substitutions > 0 && substitutions <= 2;
    }

    function matchRegisteredPlate(value, registeredPlates) {
        const targets = Array.from(registeredPlates || [])
            .map(plate => parseTurkishPlate(String(plate)))
            .filter(Boolean);

        const parsed = parseTurkishPlate(value);
        if (parsed) {
            const exact = targets.find(target => target.normalized === parsed.normalized);
            if (exact) {
                return { normalized: exact.normalized, corrected: false };
            }
        }

        const compact = normalizeCharacters(value).replace(/[^A-Z0-9]/g, '');
        for (const target of targets) {
            const length = target.normalized.length;
            for (let start = 0; start <= compact.length - length; start += 1) {
                const observed = compact.slice(start, start + length);
                if (isConfusionOnlyMatch(observed, target.normalized)) {
                    return { normalized: target.normalized, corrected: true };
                }
            }
        }

        return null;
    }

    function parseObjectPosition(objectPosition) {
        const keywords = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };
        const parts = String(objectPosition || '50% 50%').trim().split(/\s+/);
        const xPart = parts[0] || '50%';
        const yPart = parts[1] || (xPart === 'top' || xPart === 'bottom' ? xPart : '50%');

        function parsePart(part, fallback) {
            const normalized = part.toLowerCase();
            if (Object.prototype.hasOwnProperty.call(keywords, normalized)) {
                return keywords[normalized];
            }
            if (normalized.endsWith('%')) {
                const value = Number.parseFloat(normalized) / 100;
                if (Number.isFinite(value)) {
                    return Math.min(1, Math.max(0, value));
                }
            }
            return fallback;
        }

        return {
            x: parsePart(xPart, 0.5),
            y: parsePart(yPart, 0.5),
        };
    }

    function mapOverlayToVideoSource({
        videoWidth,
        videoHeight,
        displayRect,
        overlayRect,
        objectFit = 'cover',
        objectPosition = '50% 50%',
    }) {
        if (
            videoWidth <= 0
            || videoHeight <= 0
            || displayRect.width <= 0
            || displayRect.height <= 0
            || overlayRect.width <= 0
            || overlayRect.height <= 0
        ) {
            throw new Error('Video veya görüntü alanı henüz hazır değil.');
        }

        const sourcePerCssX = videoWidth / displayRect.width;
        const sourcePerCssY = videoHeight / displayRect.height;
        const roiX = overlayRect.left - displayRect.left;
        const roiY = overlayRect.top - displayRect.top;

        let rawSourceX;
        let rawSourceY;
        let rawSourceW;
        let rawSourceH;

        if (objectFit === 'fill') {
            rawSourceX = roiX * sourcePerCssX;
            rawSourceY = roiY * sourcePerCssY;
            rawSourceW = overlayRect.width * sourcePerCssX;
            rawSourceH = overlayRect.height * sourcePerCssY;
        } else {
            const sourcePerCss = objectFit === 'contain'
                ? Math.max(sourcePerCssX, sourcePerCssY)
                : Math.min(sourcePerCssX, sourcePerCssY);
            const displayedWidth = videoWidth / sourcePerCss;
            const displayedHeight = videoHeight / sourcePerCss;
            const position = parseObjectPosition(objectPosition);
            const offsetX = (displayRect.width - displayedWidth) * position.x;
            const offsetY = (displayRect.height - displayedHeight) * position.y;

            rawSourceX = (roiX - offsetX) * sourcePerCss;
            rawSourceY = (roiY - offsetY) * sourcePerCss;
            rawSourceW = overlayRect.width * sourcePerCss;
            rawSourceH = overlayRect.height * sourcePerCss;
        }

        const x = Math.max(0, rawSourceX);
        const y = Math.max(0, rawSourceY);
        const right = Math.min(videoWidth, rawSourceX + rawSourceW);
        const bottom = Math.min(videoHeight, rawSourceY + rawSourceH);
        const w = right - x;
        const h = bottom - y;

        if (w <= 0 || h <= 0) {
            throw new Error('OCR çerçevesi video karesinin tamamen dışında kaldı.');
        }

        if (w / rawSourceW < 0.95 || h / rawSourceH < 0.95) {
            throw new Error('Plaka çerçevesi kamera görüntüsüyle doğru hizalanmadı.');
        }

        return { x, y, w, h };
    }

    return {
        parseTurkishPlate,
        matchRegisteredPlate,
        mapOverlayToVideoSource,
    };
}));
