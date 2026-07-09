import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyD-lL_QA-2L3lV2LhOcpYHHR1nnSNdSWwo",
  authDomain: "miqat-948fc.firebaseapp.com",
  projectId: "miqat-948fc",
  storageBucket: "miqat-948fc.firebasestorage.app",
  messagingSenderId: "1023977255020",
  appId: "1:1023977255020:web:ea4eeb022bdbf3fd672849",
  measurementId: "G-9CKQ95K4BS"
};

const app = initializeApp(firebaseConfig);

let authPersistence;
if (Platform.OS === "web") {
  authPersistence = browserLocalPersistence;
} else {
  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  authPersistence = getReactNativePersistence(AsyncStorage);
}

export const auth = initializeAuth(app, {
  persistence: authPersistence,
});

export const db = getFirestore(app);