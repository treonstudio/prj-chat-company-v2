// Resource wrapper for async operations (similar to Android)
export type Resource<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

export const Resource = {
  loading: <T>(): Resource<T> => ({ status: 'loading' }),
  success: <T>(data: T): Resource<T> => ({ status: 'success', data }),
  error: <T>(message: string): Resource<T> => ({ status: 'error', message }),
};
