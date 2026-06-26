// utils/mail.ts
import { type Reservation } from '@prisma/client';

// Simple placeholder for sending email notifications.
// In production replace with Nodemailer or SendGrid implementation.

export async function sendReservationEmail(reservation: Reservation) {
  // For demo, just log to console.
  console.log('📧 Sending reservation email:', reservation);
  // Simulate async operation
  return Promise.resolve();
}
