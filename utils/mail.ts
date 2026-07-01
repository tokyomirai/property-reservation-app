// utils/mail.ts
import { type Reservation } from '@prisma/client';

// TODO: 本番運用に応じて、必要に応じてNodemailerやSendGrid等のメール送信ロジックを統合してください。

export async function sendReservationEmail(reservation: Reservation) {
  // メール通知シミュレーション（必要に応じて送信実装に差し替えてください）
  console.log('📧 Sending reservation email:', reservation);
  // Simulate async operation
  return Promise.resolve();
}
