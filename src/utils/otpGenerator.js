/**
 * OTP Generator and Validator
 * Matches web app's otpGenerator.js
 */

/**
 * Generate a 6-digit OTP
 */
export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Get OTP expiration time (5 minutes from now)
 */
export function getOTPExpiration() {
  const now = new Date();
  const expiration = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
  return expiration;
}

/**
 * Verify OTP
 * @param {string} enteredOTP - OTP entered by user
 * @param {string} storedOTP - OTP stored in database
 * @param {Date|Timestamp} expiresAt - Expiration timestamp
 * @returns {object} - { valid: boolean, message: string }
 */
export function verifyOTP(enteredOTP, storedOTP, expiresAt) {
  if (!enteredOTP || !storedOTP) {
    return {
      valid: false,
      message: 'OTP is required',
    };
  }

  if (enteredOTP !== storedOTP) {
    return {
      valid: false,
      message: 'Invalid OTP',
    };
  }

  // Handle Firestore Timestamp
  let expirationDate;
  if (expiresAt?.toDate) {
    expirationDate = expiresAt.toDate();
  } else if (expiresAt instanceof Date) {
    expirationDate = expiresAt;
  } else if (typeof expiresAt === 'string') {
    expirationDate = new Date(expiresAt);
  } else {
    return {
      valid: false,
      message: 'Invalid OTP expiration',
    };
  }

  const now = new Date();
  if (now > expirationDate) {
    return {
      valid: false,
      message: 'OTP has expired',
    };
  }

  return {
    valid: true,
    message: 'OTP verified successfully',
  };
}

/**
 * Format phone number to E.164 format
 * @param {string} phoneNumber - Phone number
 * @param {string} countryCode - Country code (e.g., '+1', '+91')
 * @returns {string} - Formatted phone number
 */
export function formatPhoneNumber(phoneNumber, countryCode = '+1') {
  // Remove all non-digits
  const cleaned = phoneNumber.replace(/\D/g, '');

  // If it already has country code, return as is
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }

  // Add country code
  return `${countryCode}${cleaned}`;
}

/**
 * Validate phone number format
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} - True if valid
 */
export function isValidPhoneNumber(phoneNumber) {
  // Remove all non-digits
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Must be at least 10 digits
  return cleaned.length >= 10;
}
