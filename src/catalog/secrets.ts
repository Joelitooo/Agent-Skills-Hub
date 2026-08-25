export const SECRET_FILE_PATTERNS: readonly RegExp[] = [
  /^\.env(?:\..+)?$/i,
  /^(?:credentials|secrets?|service-account.*)\.json$/i,
  /^\.netrc$/i,
  /^\.pypirc$/i,
  /^\.npmrc$/i,
  /^id_rsa$/i,
  /^id_dsa$/i,
  /^id_ecdsa$/i,
  /^id_ed25519$/i,
  /^.+\.(?:pem|key|p12|pfx|keystore)$/i,
  /^authorized_keys$/i,
  /^\.git-credentials$/i,
  /^aws_credentials$/i,
];

export const SECRET_CONTENT_PATTERNS: readonly { code: string; pattern: RegExp; message: string }[] = [
  {
    code: "secret-private-key",
    pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA |ENCRYPTED )?PRIVATE KEY-----/,
    message: "File appears to contain a private key.",
  },
  {
    code: "secret-aws-key",
    pattern: /(?:^|[^A-Z0-9_])(?:AWS_SECRET_ACCESS_KEY|aws_secret_access_key)\s*[=:]\s*\S+/,
    message: "File appears to contain an AWS secret access key.",
  },
  {
    code: "secret-github-token",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/,
    message: "File appears to contain a GitHub token.",
  },
  {
    code: "secret-slack-token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
    message: "File appears to contain a Slack token.",
  },
  {
    code: "secret-openai-key",
    pattern: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b/,
    message: "File appears to contain an API key.",
  },
];

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".yml",
  ".yaml",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".py",
  ".sh",
  ".bash",
  ".zsh",
  ".ps1",
  ".env",
  ".toml",
  ".ini",
  ".cfg",
  ".xml",
  ".html",
  ".css",
  ".svg",
]);

const MAX_SECRET_SCAN_BYTES = 512_000;

export function isSecretFileName(fileName: string): boolean {
  const base = fileName.replace(/\\/g, "/").split("/").pop() ?? fileName;
  return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(base));
}

export function looksLikeTextFile(fileName: string): boolean {
  const ext = fileName.includes(".") ? `.${fileName.split(".").pop()?.toLowerCase()}` : "";
  if (TEXT_EXTENSIONS.has(ext)) {
    return true;
  }
  const base = fileName.replace(/\\/g, "/").split("/").pop() ?? "";
  return base === "SKILL.md" || base.startsWith(".env") || !base.includes(".");
}

export { MAX_SECRET_SCAN_BYTES };
