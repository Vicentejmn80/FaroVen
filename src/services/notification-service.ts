import { notificationRepository } from '@/repositories/notification-repository'

export const notificationService = {
  listForUser: notificationRepository.listForUser,
  markRead: notificationRepository.markRead,
  markAllRead: notificationRepository.markAllRead,
}
