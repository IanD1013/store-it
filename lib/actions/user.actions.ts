'use server';

import { ID, Query } from 'node-appwrite';
import { createAdminClient } from '../appwrite';
import { appwriteConfig } from '../appwrite/config';
import { parseStringify } from '../utils';

/**
 * Create account flow:
 *
 * 1. User enters full name and email
 * 2. Check if the user already exist using the email (we will use this to identify if we still need to create a user document or not)
 * 3. Send OTP to user's email
 * 4. This will send a secret key for creating a session. The secret key or OTP will be sent to the user's account email
 * 5. Create a new user document if the user is a new user
 * 6. Return the user's accountId that will be used to complete the login
 * 7. Verify the OTP and authenticate to login
 */

const getUserByEmail = async (email: string) => {
  const { databases } = await createAdminClient();
  const result = await databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.usersCollectionId, [Query.equal('email', [email])]);

  return result.total > 0 ? result.documents[0] : null;
};

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

const sendEmailOTP = async ({ email }: { email: string }) => {
  const { account } = await createAdminClient();

  try {
    const session = await account.createEmailToken(ID.unique(), email);

    return session.userId;
  } catch (error) {
    handleError(error, 'Failed to send email OTP');
  }
};

export const createAccount = async ({ fullName, email }: { fullName: string; email: string }) => {
  const existingUser = await getUserByEmail(email);

  const accountId = await sendEmailOTP({ email });

  if (!accountId) throw new Error('Failed to send an OTP.');

  if (!existingUser) {
    const { databases } = await createAdminClient();

    try {
      await databases.createDocument(appwriteConfig.databaseId, appwriteConfig.usersCollectionId, ID.unique(), {
        email,
        fullName,
        avatar: 'https://cdn.pixabay.com/photo/2016/08/08/09/17/avatar-1577909_1280.png',
        accountId,
      });
    } catch (error) {
      handleError(error, 'Failed to create a new user document');
    }
  }

  return parseStringify({ accountId });
};
