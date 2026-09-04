import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* =========================================================
   EMAIL-BASED AUTH
========================================================= */
export async function logIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email.trim());
}

export function logOut() {
  return signOut(auth);
}

export function updateDisplayName(user, displayName) {
  return updateProfile(user, { displayName: displayName.trim() });
}

export async function changePassword(user, currentPassword, newPassword) {
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPassword);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function friendlyAuthError(err) {
  const code = err && err.code;
  switch (code) {
    case 'auth/email-already-in-use': return 'An account with that email already exists. Try logging in instead.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password': return 'Incorrect email or password.';
    case 'auth/user-not-found': return 'No account found with that email. Please contact us to get access.';
    case 'auth/too-many-requests': return 'Too many failed attempts — please try again in a moment.';
    case 'auth/requires-recent-login': return 'For security, please log out and log back in before changing your password.';
    default: return 'Something went wrong: ' + (err && err.message ? err.message : String(err));
  }
}

/* =========================================================
   FIRESTORE COLLECTIONS (scoped to the signed-in user)
   Path shape: users/{uid}/<collection>/{docId}
========================================================= */
function userCollection(uid, name) {
  return collection(db, 'users', uid, name);
}

export function trucksRef(uid) { return userCollection(uid, 'trucks'); }
export function tripsRef(uid) { return userCollection(uid, 'trips'); }
export function expensesRef(uid) { return userCollection(uid, 'expenses'); }
export function paymentsRef(uid) { return userCollection(uid, 'payments'); }
export function expenseTypesRef(uid) { return userCollection(uid, 'expenseTypes'); }

export function listenCollection(ref, cb) {
  const q = query(ref, orderBy('createdAt', 'asc'));
  return onSnapshot(q, snap => {
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    cb(rows);
  });
}

export async function addDocWithId(ref, data) {
  const docRef = await addDoc(ref, { ...data, createdAt: serverTimestamp() });
  return docRef.id;
}
export function updateDocById(ref, id, data) {
  return updateDoc(doc(ref, id), data);
}
export function deleteDocById(ref, id) {
  return deleteDoc(doc(ref, id));
}
export function setDocById(ref, id, data) {
  return setDoc(doc(ref, id), data);
}

/* Atomically reserve the next trip reference sequence number
   (TRP-2026-0001 etc.) so concurrent dispatches never collide. */
export async function nextTripSequence(uid) {
  const counterDoc = doc(db, 'users', uid, 'meta', 'counters');
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterDoc);
    const current = snap.exists() ? (snap.data().nextTripSeq || 1) : 1;
    tx.set(counterDoc, { nextTripSeq: current + 1 }, { merge: true });
    return current;
  });
  return seq;
}

export function listenTripCounter(uid, cb) {
  const counterDoc = doc(db, 'users', uid, 'meta', 'counters');
  return onSnapshot(counterDoc, snap => {
    cb(snap.exists() ? (snap.data().nextTripSeq || 1) : 1);
  });
}

/* =========================================================
   LICENSING
   A signed-in user only gets data access once an admin creates
   a doc at licenses/{their-lowercased-email} in the Firebase
   Console (see firestore.rules). listenLicense reports live
   whether that doc exists, so access unlocks/locks automatically.
========================================================= */
export function listenLicense(email, cb) {
  const ref = doc(db, 'licenses', email.trim().toLowerCase());
  return onSnapshot(
    ref,
    snap => cb(snap.exists(), snap.exists() ? snap.data() : null),
    () => cb(false, null)
  );
}
