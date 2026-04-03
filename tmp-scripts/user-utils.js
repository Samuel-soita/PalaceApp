"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNextMembershipNumber = generateNextMembershipNumber;
exports.isEligibleForRenewal = isEligibleForRenewal;
var prisma_js_1 = require("./prisma.js");
/**
 * Generates the next membership number based on priority rules:
 * - Format: SEQ/BRANCH/YEAR (e.g., 001/001/2027)
 * - SEQ is 3 digits, starting from 001.
 * - Department Leaders get priority (lowest numbers).
 * - Members follows after leaders.
 */
function generateNextMembershipNumber(role_1, targetYear_1) {
    return __awaiter(this, arguments, void 0, function (role, targetYear, branch) {
        var yearSuffix, existingUsers, existingSeqs, maxSeq, nextSeq, leaders, leaderSeqs, maxLeaderSeq, members, memberSeqs, maxMemberSeq, seqStr;
        if (branch === void 0) { branch = '001'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    yearSuffix = "/".concat(branch, "/").concat(targetYear);
                    return [4 /*yield*/, prisma_js_1.default.user.findMany({
                            where: {
                                membershipNumber: {
                                    endsWith: yearSuffix
                                }
                            },
                            select: {
                                membershipNumber: true,
                                role: true
                            }
                        })];
                case 1:
                    existingUsers = _a.sent();
                    existingSeqs = existingUsers.map(function (u) { return parseInt(u.membershipNumber.split('/')[0], 10); });
                    maxSeq = existingSeqs.length > 0 ? Math.max.apply(Math, existingSeqs) : 0;
                    if (role === 'DEPARTMENT_LEADER' || role === 'PASTOR' || role === 'SUPER_ADMIN' || role === 'WATUA') {
                        leaders = existingUsers.filter(function (u) { return ['DEPARTMENT_LEADER', 'PASTOR', 'SUPER_ADMIN', 'WATUA'].includes(u.role); });
                        leaderSeqs = leaders.map(function (u) { return parseInt(u.membershipNumber.split('/')[0], 10); });
                        maxLeaderSeq = leaderSeqs.length > 0 ? Math.max.apply(Math, leaderSeqs) : 0;
                        nextSeq = maxLeaderSeq + 1;
                        while (existingSeqs.includes(nextSeq)) {
                            nextSeq++;
                        }
                    }
                    else {
                        members = existingUsers.filter(function (u) { return !['DEPARTMENT_LEADER', 'PASTOR', 'SUPER_ADMIN', 'WATUA'].includes(u.role); });
                        memberSeqs = members.map(function (u) { return parseInt(u.membershipNumber.split('/')[0], 10); });
                        maxMemberSeq = memberSeqs.length > 0 ? Math.max.apply(Math, memberSeqs) : 100;
                        nextSeq = maxMemberSeq + 1;
                        while (existingSeqs.includes(nextSeq)) {
                            nextSeq++;
                        }
                    }
                    seqStr = String(nextSeq).padStart(3, '0');
                    return [2 /*return*/, "".concat(seqStr).concat(yearSuffix)];
            }
        });
    });
}
/**
 * Checks if a user is eligible for renewal (3 weeks before expiry).
 */
function isEligibleForRenewal(expiry) {
    if (!expiry)
        return { eligible: true, daysRemaining: 0 };
    var now = new Date();
    var expiryDate = new Date(expiry);
    var diffTime = expiryDate.getTime() - now.getTime();
    var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Eligible if expires in 21 days or less
    return {
        eligible: diffDays <= 21,
        daysRemaining: diffDays
    };
}
