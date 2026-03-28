export function isHorizonAdmin() {
  return process.env.NODE_ENV !== 'production' || process.env.HORIZON_ADMIN_ENABLED === 'true'
}

export function requireHorizonAdmin() {
  if (!isHorizonAdmin()) {
    throw new Error('Horizon Admin access required')
  }
}
