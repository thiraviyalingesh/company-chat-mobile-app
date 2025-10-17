/**
 * Auth Service - Firebase Cloud Functions integration
 */

import functions from '@react-native-firebase/functions';

/**
 * Send OTP to user's phone number
 * @param {string} phoneNumber - Phone number in E.164 format
 * @returns {Promise} - OTP response
 */
export async function sendOTP(phoneNumber) {
  try {
    const sendOTPFunction = functions().httpsCallable('sendOTP');
    const result = await sendOTPFunction({ phoneNumber });

    return {
      success: true,
      ...result.data,
    };
  } catch (error) {
    console.error('sendOTP error:', error);
    throw error;
  }
}

/**
 * Complete signup after OTP verification
 * @param {object} signupData - { phoneNumber, name, profilePictureUrl, uid }
 * @returns {Promise} - Signup result
 */
export async function completeSignup(signupData) {
  try {
    const completeSignupFunction = functions().httpsCallable('completeSignup');
    const result = await completeSignupFunction(signupData);

    return {
      success: true,
      ...result.data,
    };
  } catch (error) {
    console.error('completeSignup error:', error);
    throw error;
  }
}
