import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { getIdTokenResult } from "firebase/auth";

export async function isUidAdmin(uid: string) {
  try {
    const currentUser = auth.currentUser;

    if (currentUser?.uid === uid) {
      try {
        const token = await getIdTokenResult(currentUser);
        if (token.claims?.admin === true) {
          return true;
        }
      } catch (tokenErr) {
        console.warn("Failed to read admin custom claim", tokenErr);
      }
    }

    const ref = doc(db, "admins", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return true;

    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && userSnap.data()?.role === "admin") {
      return true;
    }

    return false;
  } catch (err) {
    console.error("Failed to check admin status", err);
    return false;
  }
}
