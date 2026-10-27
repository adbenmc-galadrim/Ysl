export {
  buildMailUrl,
  encodeMailText,
  MAIL_TARGETS,
  splitAddresses,
} from './urls';
export type { MailMessage, MailTarget } from './urls';
export {
  damageNotice,
  formatPickupHours,
  isMailVariable,
  MAIL_VARIABLES,
  mailValues,
  parcelBullets,
  pickupValues,
  renderMail,
  renderText,
  REPLY_COLLEAGUE,
  REPLY_NOT_MINE,
  replyLink,
} from './render';
export type {
  MailFields,
  MailValues,
  MailVariable,
  RenderedMail,
  RenderedText,
} from './render';
export {
  DEFAULT_TEMPLATES,
  MAIL_BODY_TESTED_MAX,
  NOTIFICATION_TYPES,
  SAMPLE_MAIL,
  SAMPLE_PICKUP_VALUES,
  TEMPLATE_BODY_MAX,
  TEMPLATE_NAME_MAX,
  TEMPLATE_SUBJECT_MAX,
} from './templates';
export type {
  DefaultTemplateType,
  NotificationType,
  TemplateText,
} from './templates';
export {
  canMoveNotification,
  FAILED_REASON_MAX,
  NOTIFICATION_STATUSES,
  notificationRow,
  notifyParcel,
} from './notification';
export type {
  NotifiableParcel,
  NotificationRow,
  NotificationStatus,
  NotifyChange,
  NotifySkip,
} from './notification';
