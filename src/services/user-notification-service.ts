import { userNotificationRepository } from '@/repositories/user-notification-repository'

export const userNotificationService = {
  listForUser: userNotificationRepository.listForUser,
  markRead: userNotificationRepository.markRead,
  markAllRead: userNotificationRepository.markAllRead,
}
