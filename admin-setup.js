// Admin Setup Script
// Run this in browser console to initialize admin permissions
// Replace 'ADMIN_UID_HERE' with the actual Firebase Auth UID of the admin user

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCQk1mGaPiiHe0D2j20h-cuUsfrG-mvMIA",
  authDomain: "edubridge-landing-web.firebaseapp.com",
  projectId: "edubridge-landing-web",
  storageBucket: "edubridge-landing-web.firebasestorage.app",
  messagingSenderId: "998209261117",
  appId: "1:998209261117:web:5b8f7e87e6dc9fb2602454",
  measurementId: "G-Y44CK7MLEV"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({})
});

// Function to add admin user
async function addAdminUser(uid, email) {
  try {
    await setDoc(doc(db, "admins", uid), {
      email: email,
      role: "admin",
      createdAt: new Date(),
      permissions: ["approve_tutors", "reject_tutors", "view_reports", "manage_users"]
    });
    console.log(`Admin user ${email} added successfully!`);
  } catch (error) {
    console.error("Error adding admin user:", error);
  }
}

// Usage: Replace with actual admin UID and email
// addAdminUser("ADMIN_UID_HERE", "admin@example.com");