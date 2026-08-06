import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
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
   USERNAME-BASED AUTH
   Firebase Auth needs an email, so a username like "jsmith"
   is stored internally as jsmith@truckmanager.local. The user
   never sees or types an email.
========================================================= */
const USERNAME_DOMAIN = '@truckmanager.local';
function usernameToEmail(username) {
  return username.trim().toLowerCase().replace(/\s+/g, '') + USERNAME_DOMAIN;
}

export async function signUp(username, password) {
  const email = usernameToEmail(username);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: username.trim() });
  return cred.user;
}

export async function logIn(username, password) {
  const email = usernameToEmail(username);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export function logOut() {
  return signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function friendlyAuthError(err) {
  const code = err && err.code;
  switch (code) {
    case 'auth/email-already-in-use': return 'Username-kan horey ayaa loo isticmaalay. Isku day mid kale.';
    case 'auth/invalid-email': return 'Username sax ah geli (xarfo iyo tirooyin kaliya).';
    case 'auth/weak-password': return 'Password waa inuu ka koobnaadaa ugu yaraan 6 xaraf.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password': return 'Username ama password khaldan.';
    case 'auth/user-not-found': return 'User-kan lama helin. Hubi username-ka ama isdiiwaangeli.';
    case 'auth/too-many-requests': return 'Isku day badan oo khaldan ayaa la sameeyay — mar kale isku day wax yar ka dib.';
    default: return 'Khalad ayaa dhacay: ' + (err && err.message ? err.message : String(err));
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
