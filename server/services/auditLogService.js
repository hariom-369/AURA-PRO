import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

// Fire-and-forget by design: a logging failure must never block or fail the
// admin action it's recording.
export async function recordAuditLog({ actor, action, targetType, targetId, metadata = {} }) {
  try {
    await AuditLog.create({ actor, action, targetType, targetId, metadata });
  } catch (error) {
    logger.error('audit_log_write_failed', { action, targetType, targetId: String(targetId), error: error.message });
  }
}
