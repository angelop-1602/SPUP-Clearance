import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/**
 * TEMPORARY UTILITY - Delete this file after creating the admin user
 * This function creates the admin user programmatically
 */
export async function createAdminUser(password: string) {
  try {
    const adminEmail = 'cprint@spup.edu.ph';
    
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      adminEmail, 
      password
    );
    
    console.log('Admin user created successfully:', userCredential.user.email);
    return userCredential.user;
  } catch (error: unknown) {
    console.error('Error creating admin user:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Uncomment and run this in browser console once:
// createAdminUser('your_secure_password_here').then(() => console.log('Done')); 