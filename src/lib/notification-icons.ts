import {
  AlertTriangle,
  Bell,
  FileText,
  MessageSquare,
  Package,
  Shield,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  'user-plus': UserPlus,
  'file-text': FileText,
  'shield': Shield,
  'message-square': MessageSquare,
  'package': Package,
  'alert-triangle': AlertTriangle,
  bell: Bell,
}

export function notificationIcon(type: string, iconKey?: string | null): LucideIcon {
  if (iconKey && ICONS[iconKey]) return ICONS[iconKey]
  if (type.includes('report')) return FileText
  if (type.includes('coordinator') || type.includes('request')) return UserPlus
  if (type.includes('need') || type.includes('delivery')) return Package
  if (type.includes('error') || type.includes('critical')) return AlertTriangle
  if (type.includes('feedback') || type.includes('message') || type.includes('faro')) return MessageSquare
  if (type.includes('admin')) return Shield
  return Bell
}
