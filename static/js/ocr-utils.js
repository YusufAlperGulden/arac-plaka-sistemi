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
    const OCR_TO_DIGIT = {
        O: '0',
        Q: '0',
        I: '1',
        L: '1',
        Z: '2',
        S: '5',
        G: '6',
        B: '8',
    };
    const OCR_TO_LETTER = {
        0: 'O',
        1: 'I',
        2: 'Z',
        5: 'S',
        6: 'G',
        8: 'B',
    };
    const PLATE_ALLOWED_LETTERS = 'ABCDEFGHIJKLMNOPRSTUVYZ';
    const PLATE_ALLOWED_LETTER_SET = new Set(PLATE_ALLOWED_LETTERS);
    const PLATE_DIGIT_COUNTS_BY_LETTER_COUNT = Object.freeze({
        1: Object.freeze([4, 5]),
        2: Object.freeze([3, 4]),
        3: Object.freeze([2, 3]),
    });

    function normalizeCharacters(value) {
        return String(value || '').toUpperCase();
    }

    function hasContiguousOcrProvinceSource(source) {
        const firstToken = /[A-Z0-9]+/.exec(source);
        return !firstToken || firstToken[0].length !== 1;
    }

    function buildPlate(
        provinceText,
        letters,
        digits,
        {
            provinceCorrectionCount = 0,
            provinceLiteralDigitCount = 2,
        } = {}
    ) {
        const provinceCode = Number(provinceText);

        if (
            !/^\d{2}$/.test(provinceText)
            || !Number.isInteger(provinceCode)
            || provinceCode < 1
            || provinceCode > 81
        ) {
            return null;
        }

        if (
            !Array.from(letters).every(letter => PLATE_ALLOWED_LETTER_SET.has(letter))
            || !PLATE_DIGIT_COUNTS_BY_LETTER_COUNT[letters.length]?.includes(digits.length)
        ) {
            return null;
        }

        return {
            normalized: provinceText + letters + digits,
            provinceCode,
            letters,
            digits,
            provinceCorrectionCount,
            provinceLiteralDigitCount,
        };
    }

    function hasSafeProvinceEvidenceForStrictAutoAcceptance(parsedPlate) {
        if (!parsedPlate) {
            return false;
        }

        const {
            provinceCorrectionCount,
            provinceLiteralDigitCount,
        } = parsedPlate;

        return (
            Number.isInteger(provinceCorrectionCount)
            && provinceCorrectionCount >= 0
            && provinceCorrectionCount <= 1
            && Number.isInteger(provinceLiteralDigitCount)
            && provinceLiteralDigitCount >= 1
            && provinceLiteralDigitCount <= 2
        );
    }

    function convertOcrSegment(value, expectedType) {
        let converted = '';
        let corrections = 0;

        for (const character of value) {
            if (expectedType === 'digit') {
                if (/\d/.test(character)) {
                    converted += character;
                } else if (OCR_TO_DIGIT[character]) {
                    converted += OCR_TO_DIGIT[character];
                    corrections += 1;
                } else {
                    return null;
                }
            } else if (PLATE_ALLOWED_LETTER_SET.has(character)) {
                converted += character;
            } else if (OCR_TO_LETTER[character]) {
                converted += OCR_TO_LETTER[character];
                corrections += 1;
            } else {
                return null;
            }
        }

        return { value: converted, corrections };
    }

    function parsePlateWithOcrCorrections(compact) {
        const candidates = [];

        for (let letterCount = 1; letterCount <= 3; letterCount += 1) {
            const provinceSource = compact.slice(0, 2);
            const lettersSource = compact.slice(2, 2 + letterCount);
            const digitsSource = compact.slice(2 + letterCount);
            if (!provinceSource || lettersSource.length !== letterCount || !digitsSource) {
                continue;
            }

            const province = convertOcrSegment(provinceSource, 'digit');
            const letters = convertOcrSegment(lettersSource, 'letter');
            const digits = convertOcrSegment(digitsSource, 'digit');
            if (!province || !letters || !digits) {
                continue;
            }

            const correctionCount = (
                province.corrections
                + letters.corrections
                + digits.corrections
            );
            if (correctionCount < 1) {
                continue;
            }

            const parsed = buildPlate(
                province.value,
                letters.value,
                digits.value,
                {
                    provinceCorrectionCount: province.corrections,
                    provinceLiteralDigitCount: Array.from(provinceSource)
                        .filter(character => /\d/.test(character))
                        .length,
                }
            );
            if (parsed) {
                candidates.push({
                    ...parsed,
                    ocrCorrected: true,
                    correctionCount,
                });
            }
        }

        candidates.sort((left, right) => (
            left.correctionCount - right.correctionCount
        ));
        if (!candidates.length) {
            return null;
        }

        const minimumCorrections = candidates[0].correctionCount;
        const minimumCandidates = candidates.filter(
            candidate => candidate.correctionCount === minimumCorrections
        );
        const normalizedValues = new Set(
            minimumCandidates.map(candidate => candidate.normalized)
        );

        // Bölüm sınırı aynı maliyetle iki farklı geçerli plakaya dönüşüyorsa
        // tahmin yürütmek yerine kullanıcı onayına/local fallback'e bırak.
        return normalizedValues.size === 1 ? minimumCandidates[0] : null;
    }

    function parseTurkishPlate(value, { allowOcrCorrections = true } = {}) {
        if (typeof value !== 'string' || !value.trim()) {
            return null;
        }

        const source = normalizeCharacters(value);
        const separatedPattern = /(?:^|[^A-Z0-9])(\d{2})[\s\-_.]*([A-PR-VYZ]{1,3})[\s\-_.]*(\d{2,5})(?=$|[^A-Z0-9])/g;
        let match;

        while ((match = separatedPattern.exec(source)) !== null) {
            const parsed = buildPlate(match[1], match[2], match[3]);
            if (parsed) {
                return parsed;
            }
        }

        const compact = /[ÇĞİÖŞÜ]/.test(source)
            ? ''
            : source.replace(/[^A-Z0-9]/g, '');
        const compactMatch = /^(\d{2})([A-PR-VYZ]{1,3})(\d{2,5})$/.exec(compact);
        if (compactMatch) {
            return buildPlate(compactMatch[1], compactMatch[2], compactMatch[3]);
        }

        if (
            allowOcrCorrections
            && hasContiguousOcrProvinceSource(source)
        ) {
            const corrected = parsePlateWithOcrCorrections(compact);
            if (corrected) {
                return corrected;
            }
        }

        return null;
    }

    function normalizeEstimateEvidenceKey(value) {
        if (typeof value === 'string' && value.trim()) {
            return `string:${value.trim()}`;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return `number:${value}`;
        }
        return null;
    }

    function normalizeEstimateConfidence(value) {
        const confidence = Number(value);
        if (!Number.isFinite(confidence)) {
            return 0;
        }
        return Math.min(100, Math.max(0, confidence));
    }

    function collectUniqueEstimateVotes(observations, interpretObservation) {
        const evidenceVotes = new Map();

        Array.from(observations || []).forEach((observation, observationIndex) => {
            if (!observation || typeof observation !== 'object') {
                return;
            }

            const evidenceKey = normalizeEstimateEvidenceKey(observation.evidenceKey);
            const interpreted = interpretObservation(observation.text);
            if (!evidenceKey || !interpreted) {
                return;
            }

            const confidence = normalizeEstimateConfidence(observation.confidence);
            const existing = evidenceVotes.get(evidenceKey);
            if (!existing) {
                evidenceVotes.set(evidenceKey, {
                    interpreted,
                    confidence,
                    observationIndex,
                    conflicted: false,
                });
                return;
            }

            if (existing.interpreted.key !== interpreted.key) {
                existing.conflicted = true;
                return;
            }

            if (confidence > existing.confidence) {
                existing.confidence = confidence;
                existing.observationIndex = observationIndex;
            }
        });

        const groupedVotes = new Map();
        evidenceVotes.forEach(evidenceVote => {
            if (evidenceVote.conflicted) {
                return;
            }

            const { interpreted, confidence, observationIndex } = evidenceVote;
            const vote = groupedVotes.get(interpreted.key) || {
                ...interpreted,
                count: 0,
                totalConfidence: 0,
                bestConfidence: -1,
                bestObservationIndex: -1,
            };
            vote.count += 1;
            vote.totalConfidence += confidence;
            if (
                confidence > vote.bestConfidence
                || (
                    confidence === vote.bestConfidence
                    && (
                        vote.bestObservationIndex < 0
                        || observationIndex < vote.bestObservationIndex
                    )
                )
            ) {
                vote.bestConfidence = confidence;
                vote.bestObservationIndex = observationIndex;
            }
            groupedVotes.set(interpreted.key, vote);
        });

        return Array.from(groupedVotes.values()).map(vote => ({
            ...vote,
            averageConfidence: vote.totalConfidence / vote.count,
        }));
    }

    function selectEstimateVote(votes, minimumCount) {
        const ranked = Array.from(votes || []).sort((left, right) => (
            right.count - left.count
            || right.averageConfidence - left.averageConfidence
            || left.key.localeCompare(right.key)
        ));
        const best = ranked[0];
        if (!best || best.count < minimumCount) {
            return null;
        }

        const conflicting = ranked[1];
        if (
            conflicting
            && conflicting.count === best.count
            && Math.abs(
                conflicting.averageConfidence - best.averageConfidence
            ) <= 8
        ) {
            return null;
        }

        return best;
    }

    function extractFirstStrictProvinceCode(value) {
        if (typeof value !== 'string' && typeof value !== 'number') {
            return null;
        }

        const source = String(value).trim();
        if (!source || /[^0-9\s\-_.]/.test(source)) {
            return null;
        }

        const digits = source.replace(/\D/g, '');
        for (let index = 0; index <= digits.length - 2; index += 1) {
            const provinceText = digits.slice(index, index + 2);
            const provinceCode = Number(provinceText);
            if (provinceCode >= 1 && provinceCode <= 81) {
                return { key: provinceText, provinceText, provinceCode };
            }
        }

        return null;
    }

    function inferTurkishPlateEstimate(
        fullObservations,
        provinceObservations,
        {
            minimumSuffixEvidence = 2,
            minimumProvinceEvidence = 1,
        } = {}
    ) {
        const requiredSuffixEvidence = (
            Number.isInteger(minimumSuffixEvidence)
            && minimumSuffixEvidence >= 1
        )
            ? minimumSuffixEvidence
            : 2;
        const requiredProvinceEvidence = (
            Number.isInteger(minimumProvinceEvidence)
            && minimumProvinceEvidence >= 1
        )
            ? minimumProvinceEvidence
            : 1;
        const suffixVotes = collectUniqueEstimateVotes(
            fullObservations,
            value => {
                const parsed = parseTurkishPlate(value);
                if (!parsed) {
                    return null;
                }

                return {
                    key: `${parsed.letters}|${parsed.digits}`,
                    letters: parsed.letters,
                    digits: parsed.digits,
                };
            }
        );
        const provinceVotes = collectUniqueEstimateVotes(
            provinceObservations,
            extractFirstStrictProvinceCode
        );
        const suffix = selectEstimateVote(
            suffixVotes,
            requiredSuffixEvidence
        );
        const province = selectEstimateVote(
            provinceVotes,
            requiredProvinceEvidence
        );
        if (!suffix || !province) {
            return null;
        }

        const strictPlate = parseTurkishPlate(
            `${province.provinceText}${suffix.letters}${suffix.digits}`,
            { allowOcrCorrections: false }
        );
        if (!strictPlate) {
            return null;
        }

        const totalEvidenceCount = suffix.count + province.count;
        const confidence = totalEvidenceCount > 0
            ? (
                suffix.totalConfidence + province.totalConfidence
            ) / totalEvidenceCount
            : 0;

        return {
            normalized: strictPlate.normalized,
            provinceCode: strictPlate.provinceCode,
            letters: strictPlate.letters,
            digits: strictPlate.digits,
            estimated: true,
            requiresConfirmation: true,
            confidence,
            suffixEvidenceCount: suffix.count,
            provinceEvidenceCount: province.count,
            bestFullObservationIndex: suffix.bestObservationIndex,
        };
    }

    function resolvePlateForForm(value, registeredPlates) {
        const parsed = parseTurkishPlate(value, { allowOcrCorrections: false });
        if (!parsed) {
            return null;
        }

        const exactRegisteredPlate = Array.from(registeredPlates || [])
            .map(plate => parseTurkishPlate(
                String(plate),
                { allowOcrCorrections: false }
            ))
            .filter(Boolean)
            .find(plate => plate.normalized === parsed.normalized);

        return {
            normalized: exactRegisteredPlate?.normalized || parsed.normalized,
            registered: Boolean(exactRegisteredPlate),
        };
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
            .map(plate => parseTurkishPlate(
                String(plate),
                { allowOcrCorrections: false }
            ))
            .filter(Boolean);

        const parsed = parseTurkishPlate(value);
        if (
            parsed
            && hasSafeProvinceEvidenceForStrictAutoAcceptance(parsed)
        ) {
            const exact = targets.find(target => target.normalized === parsed.normalized);
            if (exact) {
                return {
                    normalized: exact.normalized,
                    corrected: Boolean(parsed.ocrCorrected),
                };
            }
        }

        const normalizedValue = normalizeCharacters(value);
        const compact = /[ÇĞİÖŞÜ]/.test(normalizedValue)
            ? ''
            : normalizedValue.replace(/[^A-Z0-9]/g, '');
        const provinceLiteralDigitCount = Array.from(compact.slice(0, 2))
            .filter(character => /\d/.test(character))
            .length;
        if (provinceLiteralDigitCount < 1) {
            return null;
        }

        for (const target of targets) {
            const length = target.normalized.length;
            if (compact.length !== length) {
                continue;
            }
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

    function buildVerticalScanCrops(sourceCrop, frameHeight, offsets = [0, -0.5, 0.5]) {
        if (
            !sourceCrop
            || !Number.isFinite(sourceCrop.x)
            || !Number.isFinite(sourceCrop.y)
            || !Number.isFinite(sourceCrop.w)
            || !Number.isFinite(sourceCrop.h)
            || sourceCrop.w <= 0
            || sourceCrop.h <= 0
            || !Number.isFinite(frameHeight)
            || frameHeight <= 0
            || sourceCrop.h > frameHeight
        ) {
            throw new Error('Dikey OCR taraması için geçerli bir görüntü alanı gerekli.');
        }

        const maximumY = frameHeight - sourceCrop.h;
        const seenY = new Set();
        const crops = [];

        for (const offset of offsets) {
            if (!Number.isFinite(offset)) {
                continue;
            }

            const y = Math.max(0, Math.min(maximumY, sourceCrop.y + sourceCrop.h * offset));
            const roundedY = Math.round(y * 1000) / 1000;
            if (seenY.has(roundedY)) {
                continue;
            }

            seenY.add(roundedY);
            crops.push({
                x: sourceCrop.x,
                y,
                w: sourceCrop.w,
                h: sourceCrop.h,
                offset,
            });
        }

        return crops;
    }

    function clamp(value, minimum, maximum) {
        return Math.min(maximum, Math.max(minimum, value));
    }

    function rectangleArea(rectangle) {
        return Math.max(0, rectangle.w) * Math.max(0, rectangle.h);
    }

    function rectangleIntersection(left, right) {
        const x1 = Math.max(left.x, right.x);
        const y1 = Math.max(left.y, right.y);
        const x2 = Math.min(left.x + left.w, right.x + right.w);
        const y2 = Math.min(left.y + left.h, right.y + right.h);
        return {
            x: x1,
            y: y1,
            w: Math.max(0, x2 - x1),
            h: Math.max(0, y2 - y1),
        };
    }

    function plateCandidateIoU(left, right) {
        if (!left || !right) {
            return 0;
        }

        const intersectionArea = rectangleArea(rectangleIntersection(left, right));
        if (intersectionArea <= 0) {
            return 0;
        }

        const unionArea = rectangleArea(left) + rectangleArea(right) - intersectionArea;
        return unionArea > 0 ? intersectionArea / unionArea : 0;
    }

    function plateCandidatesReferToSameRegion(left, right) {
        if (!left || !right) {
            return false;
        }

        const intersectionArea = rectangleArea(rectangleIntersection(left, right));
        if (intersectionArea <= 0) {
            return false;
        }

        const minimumArea = Math.max(
            1,
            Math.min(rectangleArea(left), rectangleArea(right))
        );
        const widthSimilarity = (
            Math.min(left.w, right.w) / Math.max(1, Math.max(left.w, right.w))
        );
        const heightSimilarity = (
            Math.min(left.h, right.h) / Math.max(1, Math.max(left.h, right.h))
        );
        const scaleSimilarity = Math.min(widthSimilarity, heightSimilarity);
        const centerDistance = Math.hypot(
            (left.x + left.w / 2) - (right.x + right.w / 2),
            (left.y + left.h / 2) - (right.y + right.h / 2)
        );
        const normalizedCenterDistance = centerDistance / Math.max(
            1,
            Math.max(left.w, right.w)
        );

        return (
            plateCandidateIoU(left, right) >= 0.30
            || (
                intersectionArea / minimumArea >= 0.72
                && scaleSimilarity >= 0.45
            )
            || (
                normalizedCenterDistance <= 0.24
                && widthSimilarity >= 0.52
                && heightSimilarity >= 0.45
            )
        );
    }

    function selectTrackedPlateCandidate(candidates, previousCandidate = null) {
        const available = Array.from(candidates || []).filter(candidate => (
            candidate
            && Number.isFinite(candidate.x)
            && Number.isFinite(candidate.y)
            && Number.isFinite(candidate.w)
            && Number.isFinite(candidate.h)
            && candidate.w > 0
            && candidate.h > 0
        ));
        if (!available.length || !previousCandidate) {
            return available[0] || null;
        }

        const matches = available.filter(
            candidate => plateCandidatesReferToSameRegion(previousCandidate, candidate)
        );
        if (!matches.length) {
            return available[0];
        }

        matches.sort((left, right) => {
            const continuityScore = candidate => {
                const widthSimilarity = (
                    Math.min(candidate.w, previousCandidate.w)
                    / Math.max(1, Math.max(candidate.w, previousCandidate.w))
                );
                const heightSimilarity = (
                    Math.min(candidate.h, previousCandidate.h)
                    / Math.max(1, Math.max(candidate.h, previousCandidate.h))
                );
                const detectionScore = Number(
                    candidate.ocrScore ?? candidate.score
                ) || 0;
                return (
                    plateCandidateIoU(previousCandidate, candidate) * 0.45
                    + Math.min(widthSimilarity, heightSimilarity) * 0.25
                    + detectionScore * 0.30
                );
            };
            return continuityScore(right) - continuityScore(left);
        });

        return matches[0];
    }

    function createPlateDetectionIntegrals(imageData, width, height) {
        if (
            !imageData
            || !imageData.data
            || !Number.isInteger(width)
            || !Number.isInteger(height)
            || width < 24
            || height < 16
            || imageData.data.length < width * height * 4
        ) {
            throw new Error('Plaka tespiti için geçerli bir RGBA görüntüsü gerekli.');
        }

        const grayscale = new Uint8Array(width * height);
        const pixels = imageData.data;
        for (let index = 0, pixel = 0; pixel < grayscale.length; pixel += 1, index += 4) {
            grayscale[pixel] = Math.round(
                0.299 * pixels[index]
                + 0.587 * pixels[index + 1]
                + 0.114 * pixels[index + 2]
            );
        }

        const stride = width + 1;
        const integralSize = stride * (height + 1);
        const luminance = new Float64Array(integralSize);
        const verticalEdges = new Uint32Array(integralSize);
        const horizontalEdges = new Uint32Array(integralSize);
        const brightPixels = new Uint32Array(integralSize);
        const darkPixels = new Uint32Array(integralSize);

        for (let y = 0; y < height; y += 1) {
            let rowLuminance = 0;
            let rowVerticalEdges = 0;
            let rowHorizontalEdges = 0;
            let rowBrightPixels = 0;
            let rowDarkPixels = 0;

            for (let x = 0; x < width; x += 1) {
                const pixelIndex = y * width + x;
                const gray = grayscale[pixelIndex];
                const left = grayscale[y * width + Math.max(0, x - 1)];
                const right = grayscale[y * width + Math.min(width - 1, x + 1)];
                const top = grayscale[Math.max(0, y - 1) * width + x];
                const bottom = grayscale[Math.min(height - 1, y + 1) * width + x];

                rowLuminance += gray;
                rowVerticalEdges += Math.abs(right - left);
                rowHorizontalEdges += Math.abs(bottom - top);
                rowBrightPixels += gray >= 145 ? 1 : 0;
                rowDarkPixels += gray <= 105 ? 1 : 0;

                const integralIndex = (y + 1) * stride + x + 1;
                const previousRowIndex = integralIndex - stride;
                luminance[integralIndex] = luminance[previousRowIndex] + rowLuminance;
                verticalEdges[integralIndex] = (
                    verticalEdges[previousRowIndex] + rowVerticalEdges
                );
                horizontalEdges[integralIndex] = (
                    horizontalEdges[previousRowIndex] + rowHorizontalEdges
                );
                brightPixels[integralIndex] = (
                    brightPixels[previousRowIndex] + rowBrightPixels
                );
                darkPixels[integralIndex] = darkPixels[previousRowIndex] + rowDarkPixels;
            }
        }

        return {
            stride,
            width,
            height,
            luminance,
            verticalEdges,
            horizontalEdges,
            brightPixels,
            darkPixels,
        };
    }

    function integralRectangleSum(integral, stride, x, y, width, height) {
        const left = Math.max(0, Math.round(x));
        const top = Math.max(0, Math.round(y));
        const right = Math.max(left, Math.round(x + width));
        const bottom = Math.max(top, Math.round(y + height));
        return (
            integral[bottom * stride + right]
            - integral[top * stride + right]
            - integral[bottom * stride + left]
            + integral[top * stride + left]
        );
    }

    function scorePlateWindow(integrals, rectangle) {
        const { width: frameWidth, height: frameHeight, stride } = integrals;
        const { x, y, w, h } = rectangle;
        const area = w * h;
        const insetX = Math.max(1, Math.round(w * 0.05));
        const insetY = Math.max(1, Math.round(h * 0.12));
        const inner = {
            x: x + insetX,
            y: y + insetY,
            w: Math.max(1, w - 2 * insetX),
            h: Math.max(1, h - 2 * insetY),
        };
        const innerArea = inner.w * inner.h;

        const luminanceSum = integralRectangleSum(
            integrals.luminance,
            stride,
            inner.x,
            inner.y,
            inner.w,
            inner.h
        );
        const verticalEdgeSum = integralRectangleSum(
            integrals.verticalEdges,
            stride,
            inner.x,
            inner.y,
            inner.w,
            inner.h
        );
        const horizontalEdgeSum = integralRectangleSum(
            integrals.horizontalEdges,
            stride,
            inner.x,
            inner.y,
            inner.w,
            inner.h
        );
        const brightPixelCount = integralRectangleSum(
            integrals.brightPixels,
            stride,
            inner.x,
            inner.y,
            inner.w,
            inner.h
        );
        const darkPixelCount = integralRectangleSum(
            integrals.darkPixels,
            stride,
            inner.x,
            inner.y,
            inner.w,
            inner.h
        );

        const meanLuminance = luminanceSum / innerArea;
        const verticalEdgeDensity = verticalEdgeSum / (innerArea * 255);
        const horizontalEdgeDensity = horizontalEdgeSum / (innerArea * 255);
        const brightRatio = brightPixelCount / innerArea;
        const darkRatio = darkPixelCount / innerArea;

        if (
            meanLuminance < 45
            || verticalEdgeDensity < 0.025
            || brightRatio < 0.08
            || darkRatio < 0.015
        ) {
            return null;
        }

        const paddingX = Math.round(w * 0.16);
        const paddingY = Math.round(h * 0.55);
        const outer = {
            x: Math.max(0, x - paddingX),
            y: Math.max(0, y - paddingY),
            w: Math.min(frameWidth, x + w + paddingX) - Math.max(0, x - paddingX),
            h: Math.min(frameHeight, y + h + paddingY) - Math.max(0, y - paddingY),
        };
        const outerArea = outer.w * outer.h;
        const outerLuminance = integralRectangleSum(
            integrals.luminance,
            stride,
            outer.x,
            outer.y,
            outer.w,
            outer.h
        );
        const windowLuminance = integralRectangleSum(
            integrals.luminance,
            stride,
            x,
            y,
            w,
            h
        );
        const ringArea = Math.max(1, outerArea - area);
        const ringMean = (outerLuminance - windowLuminance) / ringArea;

        const edgeScore = clamp(
            (verticalEdgeDensity - horizontalEdgeDensity * 0.22 - 0.02) / 0.16,
            0,
            1
        );
        const brightScore = clamp((brightRatio - 0.12) / 0.52, 0, 1);
        const darkScore = clamp((darkRatio - 0.015) / 0.16, 0, 1)
            * clamp((0.58 - darkRatio) / 0.28, 0, 1);
        const mixtureScore = Math.sqrt(brightScore * darkScore);
        const contrastScore = clamp((meanLuminance - ringMean + 8) / 72, 0, 1);
        const luminanceScore = clamp(1 - Math.abs(meanLuminance - 178) / 145, 0, 1);
        const aspectRatio = w / h;
        const aspectScore = Math.exp(-Math.abs(Math.log(aspectRatio / 4.45)) * 1.55);
        const centerX = (x + w / 2) / frameWidth;
        const centerY = (y + h / 2) / frameHeight;
        const centerDistance = Math.hypot(centerX - 0.5, centerY - 0.56) / 0.75;
        const positionScore = clamp(1 - centerDistance, 0, 1);

        const score = (
            edgeScore * 0.31
            + mixtureScore * 0.23
            + contrastScore * 0.18
            + luminanceScore * 0.10
            + aspectScore * 0.11
            + positionScore * 0.07
        );

        return {
            ...rectangle,
            score,
            metrics: {
                meanLuminance,
                verticalEdgeDensity,
                horizontalEdgeDensity,
                brightRatio,
                darkRatio,
                contrast: meanLuminance - ringMean,
            },
        };
    }

    function scoreVerticalEdgePattern(integrals, rectangle) {
        const insetX = Math.max(1, Math.round(rectangle.w * 0.05));
        const insetY = Math.max(1, Math.round(rectangle.h * 0.12));
        const xStart = rectangle.x + insetX;
        const xEnd = rectangle.x + rectangle.w - insetX;
        const y = rectangle.y + insetY;
        const height = Math.max(1, rectangle.h - 2 * insetY);
        const maximumGap = Math.max(1, Math.round(rectangle.w * 0.018));
        let clusterCount = 0;
        let gap = maximumGap + 1;
        let activeCluster = false;

        for (let x = xStart; x < xEnd; x += 1) {
            const edgeSum = integralRectangleSum(
                integrals.verticalEdges,
                integrals.stride,
                x,
                y,
                1,
                height
            );
            const active = edgeSum / (height * 255) >= 0.045;

            if (active) {
                if (!activeCluster && gap > maximumGap) {
                    clusterCount += 1;
                }
                activeCluster = true;
                gap = 0;
            } else if (activeCluster) {
                gap += 1;
                if (gap > maximumGap) {
                    activeCluster = false;
                }
            }
        }

        const lowerBoundScore = clamp((clusterCount - 3) / 9, 0, 1);
        const upperBoundScore = clamp((30 - clusterCount) / 8, 0, 1);
        return {
            clusterCount,
            score: lowerBoundScore * upperBoundScore,
        };
    }

    function scorePlateCandidateForOcr(candidate, frameWidth) {
        if (
            !candidate
            || !Number.isFinite(frameWidth)
            || frameWidth <= 0
            || !Number.isFinite(candidate.w)
            || !Number.isFinite(candidate.h)
            || candidate.w <= 0
            || candidate.h <= 0
        ) {
            return 0;
        }

        const baseScore = clamp(Number(candidate.score) || 0, 0, 1);
        const widthRatio = candidate.w / frameWidth;
        const sizeScore = clamp((widthRatio - 0.12) / 0.48, 0, 1);
        const aspectRatio = candidate.w / candidate.h;
        const aspectScore = Math.exp(
            -Math.abs(Math.log(aspectRatio / 4.45)) * 1.35
        );
        const leftMarginRatio = candidate.x / frameWidth;
        const rightMarginRatio = (
            frameWidth - candidate.x - candidate.w
        ) / frameWidth;
        const clippedEdgePenalty = (
            leftMarginRatio < 0.012 || rightMarginRatio < 0.012
        ) ? 0.035 : 0;

        // A few high-contrast characters can have a higher raw detector score
        // than the enclosing plate. OCR needs the complete line, so candidate
        // width and plate-like aspect ratio receive an explicit ranking weight.
        return clamp(
            baseScore * 0.68
            + sizeScore * 0.24
            + aspectScore * 0.08
            + (candidate.merged ? 0.01 : 0)
            - clippedEdgePenalty,
            0,
            1
        );
    }

    function detectPlateCandidates(
        imageData,
        width,
        height,
        {
            maxCandidates = 5,
            minimumScore = 0.38,
            widthRatios = [0.16, 0.22, 0.30, 0.40, 0.52, 0.66, 0.80],
            aspectRatios = [2.8, 3.5, 4.3, 5.2, 6.2],
        } = {}
    ) {
        const integrals = createPlateDetectionIntegrals(imageData, width, height);
        const scored = [];

        for (const widthRatio of widthRatios) {
            if (!Number.isFinite(widthRatio) || widthRatio <= 0 || widthRatio > 1) {
                continue;
            }

            const candidateWidth = Math.max(48, Math.round(width * widthRatio));
            if (candidateWidth > width) {
                continue;
            }

            for (const aspectRatio of aspectRatios) {
                if (!Number.isFinite(aspectRatio) || aspectRatio <= 1) {
                    continue;
                }

                const candidateHeight = Math.round(candidateWidth / aspectRatio);
                if (
                    candidateHeight < Math.max(12, Math.round(height * 0.025))
                    || candidateHeight > height * 0.34
                ) {
                    continue;
                }

                const stepX = Math.max(4, Math.round(candidateWidth * 0.09));
                const stepY = Math.max(3, Math.round(candidateHeight * 0.24));
                const maximumX = width - candidateWidth;
                const maximumY = height - candidateHeight;
                const xPositions = [];
                const yPositions = [];

                for (let x = 0; x <= maximumX; x += stepX) {
                    xPositions.push(x);
                }
                if (xPositions[xPositions.length - 1] !== maximumX) {
                    xPositions.push(maximumX);
                }
                for (let y = 0; y <= maximumY; y += stepY) {
                    yPositions.push(y);
                }
                if (yPositions[yPositions.length - 1] !== maximumY) {
                    yPositions.push(maximumY);
                }

                for (const y of yPositions) {
                    for (const x of xPositions) {
                        const candidate = scorePlateWindow(integrals, {
                            x,
                            y,
                            w: candidateWidth,
                            h: candidateHeight,
                        });
                        if (candidate && candidate.score >= minimumScore) {
                            scored.push(candidate);
                        }
                    }
                }
            }
        }

        scored.sort((left, right) => right.score - left.score);
        // Keep enough raw windows for a wider, complete plate to survive even
        // when individual character fragments have sharper local contrast.
        const rerankLimit = Math.max(1500, maxCandidates * 120);
        const enrichCandidate = candidate => {
            const pattern = scoreVerticalEdgePattern(integrals, candidate);
            const sizeScore = clamp((candidate.w / width - 0.10) / 0.28, 0, 1);
            return {
                ...candidate,
                score: candidate.score * 0.78 + pattern.score * 0.17 + sizeScore * 0.05,
                metrics: {
                    ...candidate.metrics,
                    verticalEdgeClusters: pattern.clusterCount,
                },
            };
        };
        const reranked = scored.slice(0, rerankLimit).map(enrichCandidate);
        reranked.forEach(candidate => {
            candidate.ocrScore = scorePlateCandidateForOcr(candidate, width);
        });

        // A narrow window can score highly when it contains only a few clear
        // characters. Neighbouring text windows on the same horizontal line are
        // merged so the province code and the trailing digits stay in one crop.
        const mergeBase = [...reranked]
            .sort((left, right) => (
                right.ocrScore - left.ocrScore
                || right.score - left.score
            ))
            .slice(0, 160);
        const mergedKeys = new Set();
        for (let leftIndex = 0; leftIndex < mergeBase.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < mergeBase.length; rightIndex += 1) {
                const left = mergeBase[leftIndex];
                const right = mergeBase[rightIndex];
                const minimumWidth = Math.min(left.w, right.w);
                const minimumHeight = Math.min(left.h, right.h);
                const verticalOverlap = Math.max(
                    0,
                    Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y)
                );
                const horizontalDistance = Math.abs(
                    (left.x + left.w / 2) - (right.x + right.w / 2)
                );

                if (
                    verticalOverlap / Math.max(1, minimumHeight) < 0.62
                    || horizontalDistance < minimumWidth * 0.42
                    || horizontalDistance > minimumWidth * 1.05
                    || Math.max(left.h, right.h) / Math.max(1, minimumHeight) > 1.45
                ) {
                    continue;
                }

                const x = Math.min(left.x, right.x);
                const y = Math.min(left.y, right.y);
                const mergedRight = Math.max(left.x + left.w, right.x + right.w);
                const mergedBottom = Math.max(left.y + left.h, right.y + right.h);
                const rectangle = {
                    x,
                    y,
                    w: mergedRight - x,
                    h: mergedBottom - y,
                };
                const aspectRatio = rectangle.w / rectangle.h;
                const uniqueHorizontalContribution = (
                    rectangle.w - Math.max(left.w, right.w)
                );
                if (
                    aspectRatio < 2.4
                    || aspectRatio > 9.5
                    || rectangle.w > width * 0.88
                    || uniqueHorizontalContribution < minimumWidth * 0.22
                ) {
                    continue;
                }

                const key = [
                    Math.round(rectangle.x / 4),
                    Math.round(rectangle.y / 4),
                    Math.round(rectangle.w / 4),
                    Math.round(rectangle.h / 4),
                ].join(':');
                if (mergedKeys.has(key)) {
                    continue;
                }
                mergedKeys.add(key);

                const rescored = scorePlateWindow(integrals, rectangle);
                if (!rescored) {
                    continue;
                }
                const merged = enrichCandidate(rescored);
                const neighbourAverage = (left.score + right.score) / 2;
                if (merged.score >= neighbourAverage - 0.12) {
                    merged.score = clamp(
                        Math.max(merged.score, neighbourAverage + 0.025),
                        0,
                        1
                    );
                }
                merged.merged = true;
                reranked.push(merged);
            }
        }

        reranked.forEach(candidate => {
            candidate.ocrScore = scorePlateCandidateForOcr(candidate, width);
        });
        reranked.sort((left, right) => (
            right.ocrScore - left.ocrScore
            || right.score - left.score
        ));
        const selected = [];

        for (const candidate of reranked) {
            if (candidate.score < minimumScore) {
                continue;
            }
            const overlapsExisting = selected.some(existing => {
                const intersection = rectangleIntersection(candidate, existing);
                const intersectionArea = rectangleArea(intersection);
                const containment = intersectionArea / Math.max(
                    1,
                    Math.min(rectangleArea(candidate), rectangleArea(existing))
                );
                return plateCandidateIoU(candidate, existing) >= 0.42 || containment >= 0.78;
            });

            if (!overlapsExisting) {
                selected.push(candidate);
            }
            if (selected.length >= maxCandidates) {
                break;
            }
        }

        // A long plate can still be represented by two overlapping partial
        // text-line candidates after the first NMS pass. Combine those final
        // neighbours once more so both the province code and trailing digits
        // reach OCR in a single crop.
        const combinedCandidates = [];
        for (let leftIndex = 0; leftIndex < selected.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < selected.length; rightIndex += 1) {
                const left = selected[leftIndex];
                const right = selected[rightIndex];
                const minimumWidth = Math.min(left.w, right.w);
                const minimumHeight = Math.min(left.h, right.h);
                const verticalOverlap = Math.max(
                    0,
                    Math.min(left.y + left.h, right.y + right.h)
                    - Math.max(left.y, right.y)
                );
                const horizontalDistance = Math.abs(
                    (left.x + left.w / 2) - (right.x + right.w / 2)
                );
                const x = Math.min(left.x, right.x);
                const y = Math.min(left.y, right.y);
                const rightEdge = Math.max(left.x + left.w, right.x + right.w);
                const bottomEdge = Math.max(left.y + left.h, right.y + right.h);
                const rectangle = {
                    x,
                    y,
                    w: rightEdge - x,
                    h: bottomEdge - y,
                };
                const uniqueHorizontalContribution = (
                    rectangle.w - Math.max(left.w, right.w)
                );
                const aspectRatio = rectangle.w / rectangle.h;

                if (
                    verticalOverlap / Math.max(1, minimumHeight) < 0.58
                    || horizontalDistance < minimumWidth * 0.25
                    || horizontalDistance > minimumWidth * 1.10
                    || uniqueHorizontalContribution < minimumWidth * 0.18
                    || rectangle.w < width * 0.42
                    || rectangle.w > width * 0.92
                    || aspectRatio < 2.4
                    || aspectRatio > 9.5
                ) {
                    continue;
                }

                const rescored = scorePlateWindow(integrals, rectangle);
                if (!rescored) {
                    continue;
                }
                const combined = enrichCandidate(rescored);
                const neighbourAverage = (left.score + right.score) / 2;
                combined.score = clamp(
                    Math.max(combined.score, neighbourAverage + 0.015),
                    0,
                    1
                );
                combined.merged = true;
                combined.ocrScore = scorePlateCandidateForOcr(combined, width);
                combinedCandidates.push(combined);
            }
        }

        const finalPool = [...combinedCandidates, ...selected].sort(
            (left, right) => (
                right.ocrScore - left.ocrScore
                || right.score - left.score
            )
        );
        const finalSelected = [];
        for (const candidate of finalPool) {
            const overlapsExisting = finalSelected.some(existing => {
                const intersection = rectangleIntersection(candidate, existing);
                const intersectionArea = rectangleArea(intersection);
                const containment = intersectionArea / Math.max(
                    1,
                    Math.min(rectangleArea(candidate), rectangleArea(existing))
                );
                return (
                    plateCandidateIoU(candidate, existing) >= 0.42
                    || containment >= 0.78
                );
            });
            if (!overlapsExisting) {
                finalSelected.push(candidate);
            }
            if (finalSelected.length >= maxCandidates) {
                break;
            }
        }

        return finalSelected;
    }

    function mapPlateCandidatesToSource(
        candidates,
        {
            detectionWidth,
            detectionHeight,
            sourceWidth,
            sourceHeight,
            horizontalPadding = 0.08,
            verticalPadding = 0.18,
        }
    ) {
        if (
            !Number.isFinite(detectionWidth)
            || !Number.isFinite(detectionHeight)
            || !Number.isFinite(sourceWidth)
            || !Number.isFinite(sourceHeight)
            || detectionWidth <= 0
            || detectionHeight <= 0
            || sourceWidth <= 0
            || sourceHeight <= 0
        ) {
            throw new Error('Plaka adayını kaynak görüntüye eşlemek için geçerli boyutlar gerekli.');
        }

        const scaleX = sourceWidth / detectionWidth;
        const scaleY = sourceHeight / detectionHeight;

        return Array.from(candidates || []).map(candidate => {
            const rawX = candidate.x * scaleX;
            const rawY = candidate.y * scaleY;
            const rawWidth = candidate.w * scaleX;
            const rawHeight = candidate.h * scaleY;
            const paddingX = rawWidth * (
                candidate.merged ? 0.04 : horizontalPadding
            );
            const paddingY = rawHeight * (
                candidate.merged ? 0.30 : verticalPadding
            );
            const x = clamp(rawX - paddingX, 0, sourceWidth);
            const y = clamp(rawY - paddingY, 0, sourceHeight);
            const right = clamp(rawX + rawWidth + paddingX, 0, sourceWidth);
            const bottom = clamp(rawY + rawHeight + paddingY, 0, sourceHeight);

            return {
                x,
                y,
                w: right - x,
                h: bottom - y,
                detectionScore: Number(candidate.ocrScore ?? candidate.score) || 0,
                automatic: true,
            };
        }).filter(crop => crop.w > 0 && crop.h > 0);
    }

    function orderOcrCropRegions(
        automaticCrops,
        fallbackCrops,
        { automatic = false, maximumCount = 6 } = {}
    ) {
        const detected = Array.from(automaticCrops || []);
        const manual = Array.from(fallbackCrops || []);
        const ordered = automatic
            ? [
                detected[0],
                detected[1],
                manual[0],
                ...detected.slice(2),
                ...manual.slice(1),
            ]
            : [
                manual[0],
                detected[0],
                manual[1],
                detected[1],
                manual[2],
                ...detected.slice(2),
                ...manual.slice(3),
            ];
        const selected = [];

        for (const crop of ordered) {
            if (
                !crop
                || !Number.isFinite(crop.w)
                || !Number.isFinite(crop.h)
                || crop.w <= 0
                || crop.h <= 0
                || selected.some(existing => plateCandidateIoU(existing, crop) >= 0.76)
            ) {
                continue;
            }
            selected.push(crop);
            if (selected.length >= maximumCount) {
                break;
            }
        }

        return selected;
    }

    function shouldAcceptOcrConsensus({
        count = 0,
        corrected = false,
        registered = false,
    } = {}) {
        if (registered && count >= 1) {
            return true;
        }

        return corrected
            ? count >= 3
            : count >= 2;
    }

    return {
        PLATE_ALLOWED_LETTERS,
        PLATE_DIGIT_COUNTS_BY_LETTER_COUNT,
        parseTurkishPlate,
        hasSafeProvinceEvidenceForStrictAutoAcceptance,
        inferTurkishPlateEstimate,
        resolvePlateForForm,
        matchRegisteredPlate,
        mapOverlayToVideoSource,
        buildVerticalScanCrops,
        plateCandidateIoU,
        plateCandidatesReferToSameRegion,
        selectTrackedPlateCandidate,
        scorePlateCandidateForOcr,
        detectPlateCandidates,
        mapPlateCandidatesToSource,
        orderOcrCropRegions,
        shouldAcceptOcrConsensus,
    };
}));
