"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTransactionalEmail = sendTransactionalEmail;
const resend_1 = require("resend");
const admin = __importStar(require("firebase-admin"));
async function sendTransactionalEmail(payload) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.warn(`[Resend Email] RESEND_API_KEY not configured. Mocking delivery for category: ${payload.category} to ${payload.to}`);
        // Record audit event for email requirement
        try {
            await admin.firestore().collection('auditLogs').add({
                action: 'EMAIL_QUEUED_MOCK',
                actorId: 'system',
                targetResource: 'email',
                metadata: JSON.stringify({ to: payload.to, subject: payload.subject, category: payload.category }),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        catch (e) {
            // ignore
        }
        return { success: false, notice: 'Resend API key configuration required.' };
    }
    try {
        const resend = new resend_1.Resend(apiKey);
        const result = await resend.emails.send({
            from: 'A/R Tax Services <notifications@artaxservices.com>',
            to: payload.to,
            subject: payload.subject,
            html: payload.html
        });
        return { success: true, id: result.data?.id };
    }
    catch (error) {
        console.error('[Resend Error]', error);
        return { success: false, notice: error.message };
    }
}
//# sourceMappingURL=emails.js.map