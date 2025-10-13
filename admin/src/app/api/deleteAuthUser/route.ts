import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Try to import and use Firebase Admin SDK
    try {
      const { adminAuth } = await import('@/lib/firebaseAdmin');

      // Delete user from Firebase Authentication using Admin SDK
      await adminAuth.deleteUser(userId);

      return NextResponse.json({
        success: true,
        message: 'User deleted from Authentication successfully'
      });
    } catch (adminError: any) {
      console.error('Firebase Admin SDK error:', adminError);

      // If Admin SDK fails, we return an error but don't throw
      // The Firestore deletion already succeeded
      return NextResponse.json(
        {
          error: 'Failed to delete user from Authentication',
          details: adminError.message,
          note: 'Firestore document was deleted, but Authentication record remains. Please check your Firebase Admin SDK credentials or manually delete the user from Firebase Console.'
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in deleteAuthUser API:', error);

    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error.message
      },
      { status: 500 }
    );
  }
}
