import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function isUidAdmin(uid: string) {
  try {
    const ref = doc(db, "admins", uid);
    const snap = await getDoc(ref);
    return snap.exists();
  } catch (err) {
    console.error("Failed to check admin status", err);
    return false;
  }
}
