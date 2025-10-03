import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

export const db = firestore();
export const authInstance = auth();
export const storageInstance = storage();

export default {
  auth: authInstance,
  db,
  storage: storageInstance,
};
