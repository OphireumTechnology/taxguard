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
exports.bookAppointmentTransaction = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const emails_1 = require("./emails");
exports.bookAppointmentTransaction = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be logged in to book an appointment.');
    }
    const callerUid = request.auth.uid;
    const { accountantId, serviceType, scheduledTime, // ISO string
    durationMinutes = 60, timeZone = 'America/New_York', notes = '' } = request.data;
    if (!accountantId || !scheduledTime) {
        throw new https_1.HttpsError('invalid-argument', 'accountantId and scheduledTime are required.');
    }
    const startTime = new Date(scheduledTime);
    if (isNaN(startTime.getTime())) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid scheduledTime format.');
    }
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const db = admin.firestore();
    // Perform atomic conflict detection using Firestore Transaction
    const appointmentId = `apt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const appointmentRef = db.collection('appointments').doc(appointmentId);
    const result = await db.runTransaction(async (transaction) => {
        // Query existing confirmed appointments for this accountant
        const existingSnap = await transaction.get(db.collection('appointments')
            .where('accountantId', '==', accountantId)
            .where('status', 'in', ['confirmed', 'rescheduled']));
        for (const doc of existingSnap.docs) {
            const apt = doc.data();
            const existingStart = new Date(apt.scheduledTime);
            const existingEnd = new Date(existingStart.getTime() + (apt.durationMinutes || 60) * 60 * 1000);
            // Check overlap: (StartA < EndB) and (EndA > StartB)
            if (startTime < existingEnd && endTime > existingStart) {
                throw new https_1.HttpsError('already-exists', 'The requested time slot conflicts with an existing consultation for this CPA.');
            }
        }
        // No conflict, create appointment
        const newAppointmentData = {
            id: appointmentId,
            clientId: callerUid,
            accountantId,
            serviceType: serviceType || 'Tax Consultation',
            scheduledTime: startTime.toISOString(),
            durationMinutes,
            timeZone,
            status: 'confirmed',
            notes,
            meetingUrl: 'https://meet.google.com/lookup/artax-consultation-' + appointmentId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        transaction.set(appointmentRef, newAppointmentData);
        // In-app notification for client
        const clientNotifRef = db.collection('notifications').doc();
        transaction.set(clientNotifRef, {
            id: clientNotifRef.id,
            userId: callerUid,
            title: 'Consultation Confirmed',
            message: `Your ${serviceType || 'tax consultation'} is confirmed for ${startTime.toLocaleString('en-US', { timeZone: 'America/New_York' })} (EST).`,
            type: 'appointment',
            link: '/client_portal',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // In-app notification for accountant
        const accountantNotifRef = db.collection('notifications').doc();
        transaction.set(accountantNotifRef, {
            id: accountantNotifRef.id,
            userId: accountantId,
            title: 'New Client Consultation Booked',
            message: `A client has scheduled a consultation for ${startTime.toLocaleString('en-US', { timeZone: 'America/New_York' })} (EST).`,
            type: 'appointment',
            link: '/accountant_workspace',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return newAppointmentData;
    });
    // Asynchronously dispatch confirmation emails via Resend
    try {
        const clientUser = await admin.auth().getUser(callerUid);
        if (clientUser.email) {
            await (0, emails_1.sendTransactionalEmail)({
                to: clientUser.email,
                subject: `Appointment Confirmed: ${serviceType || 'Tax Consultation'} | A/R Tax Services`,
                category: 'appointment',
                html: `
          <div style="font-family: sans-serif; color: #07172B; padding: 20px;">
            <h2 style="color: #C6A15B;">A/R Tax Services, LLC</h2>
            <p>Dear ${clientUser.displayName || 'Client'},</p>
            <p>Your upcoming tax advisory consultation has been scheduled:</p>
            <ul>
              <li><strong>Service:</strong> ${serviceType || 'Tax Consultation'}</li>
              <li><strong>Date & Time:</strong> ${startTime.toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</li>
              <li><strong>Duration:</strong> ${durationMinutes} minutes</li>
              <li><strong>Timezone:</strong> America/New_York</li>
            </ul>
            <p>Join your session securely via your client portal or direct link: <a href="${result.meetingUrl}">${result.meetingUrl}</a></p>
            <p>Warm regards,<br/>A/R Tax Services Advisory Team</p>
          </div>
        `
            });
        }
    }
    catch (e) {
        console.warn('Failed to send email notification:', e);
    }
    return {
        success: true,
        appointment: result
    };
});
//# sourceMappingURL=appointments.js.map