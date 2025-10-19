import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, newPassword } = await request.json();

    console.log('updatePassword API called with userId:', userId);

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'userId and newPassword are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Try to import and use Firebase Admin SDK
    try {
      console.log('Attempting to import Firebase Admin SDK...');
      const { adminAuth } = await import('@/lib/firebaseAdmin');
      console.log('Firebase Admin SDK imported successfully');

      // Update user password using Admin SDK
      console.log('Updating user password for userId:', userId);
      await adminAuth.updateUser(userId, {
        password: newPassword,
      });

      console.log('Password updated successfully for userId:', userId);

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (adminError: any) {
      console.error('Firebase Admin SDK error:', adminError);
      console.error('Error code:', adminError.code);
      console.error('Error message:', adminError.message);

      return NextResponse.json(
        {
          error: adminError.message || 'Failed to update password',
          code: adminError.code
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in updatePassword API:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to process request'
      },
      { status: 500 }
    );
  }
}
