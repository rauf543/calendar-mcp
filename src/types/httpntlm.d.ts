declare module 'httpntlm' {
  interface NtlmOptions {
    url: string;
    username: string;
    password: string;
    domain?: string;
    headers?: Record<string, string>;
    body?: string;
  }

  interface NtlmResponse {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  type NtlmCallback = (err: Error | null, res: NtlmResponse) => void;

  export function get(options: NtlmOptions, callback: NtlmCallback): void;
  export function post(options: NtlmOptions, callback: NtlmCallback): void;
  export function put(options: NtlmOptions, callback: NtlmCallback): void;
  export function patch(options: NtlmOptions, callback: NtlmCallback): void;
  function _delete(options: NtlmOptions, callback: NtlmCallback): void;
  export { _delete as delete };
}
