/// <reference types="vite/client" />

declare module "*.json" {
  const value: unknown;
  export default value;
}

interface ImportMetaEnv {
  readonly VITE_MOCK_SENSORS?: string;
  readonly VITE_MOCK_FIXTURE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}