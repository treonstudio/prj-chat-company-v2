import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, newPassword } = await request.json();

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
      const { adminAuth } = await import('@/lib/firebaseAdmin');

      // Update user password using Admin SDK
      await adminAuth.updateUser(userId, {
        password: newPassword,
      });

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (adminError: any) {
      console.error('Firebase Admin SDK error:', adminError);

      return NextResponse.json(
        {
          error: 'Failed to update password',
          details: adminError.message
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in updatePassword API:', error);

    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error.message
      },
      { status: 500 }
    );
  }
}
