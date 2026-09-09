/**
 * Generate a random password
 * @param {number} length - Password length (default: 12)
 * @returns {string} Generated password
 */
export const generatePassword = (length = 12) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_+-=';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  return password;
};