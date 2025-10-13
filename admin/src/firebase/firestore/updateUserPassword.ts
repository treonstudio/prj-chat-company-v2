// Function to update user password via API
export default async function updateUserPassword(userId: string, newPassword: string) {
  let result = null;
  let error = null;

  try {
    const response = await fetch('/api/updatePassword', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, newPassword }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      error = new Error(errorData.error || 'Failed to update password');
    } else {
      const data = await response.json();
      result = data;
    }
  } catch (e) {
    error = e;
    console.error("Error updating password:", e);
  }

  return { result, error };
}
