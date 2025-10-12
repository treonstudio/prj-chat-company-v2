import firebase_app from "../config";
import { getFirestore, collection, getDocs } from "firebase/firestore";

export interface CallData {
  callId: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  receiverName: string;
  duration: number;
  status: string;
  type: string;
  timestamp: any;
  acceptedAt?: any;
  endedAt?: any;
}

export interface CallsStats {
  totalCalls: number;
  totalDuration: number;
  calls: CallData[];
}

// Function to retrieve all calls from Firebase
export default async function getCalls() {
  let result: CallsStats | null = null;
  let error = null;

  try {
    // Get the Firestore instance inside the function to ensure it's initialized
    const db = getFirestore(firebase_app);

    // Reference to the calls collection
    const callsRef = collection(db, "calls");
    const querySnapshot = await getDocs(callsRef);

    let totalCalls = 0;
    let totalDuration = 0;
    const calls: CallData[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data() as CallData;
      totalCalls++;
      totalDuration += data.duration || 0;
      calls.push({
        ...data,
        callId: doc.id,
      });
    });

    result = {
      totalCalls,
      totalDuration,
      calls,
    };
  } catch (e) {
    error = e;
    console.error("Error in getCalls:", e);
  }

  return { result, error };
}
